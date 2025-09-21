import OpenAI from 'openai';

let client;
function getClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  if (!client) client = new OpenAI({ apiKey });
  return client;
}

const NORMALIZER_SYS = `
You are a location normalizer. Task: infer CITY and COUNTRY from a free-text user input.
Return STRICT JSON:
{
  "city": string|null,
  "country": string|null,
  "confidence": number,
  "needsCity": boolean,
  "needsCountry": boolean,
  "normalized": string|null,
  "note": string|null
}
Rules:
- Fix typos (e.g., "Amstrdam" -> "Amsterdam").
- If user gives only country: set needsCity=true.
- If user gives only city: infer most common country; if ambiguous set needsCountry=true.
- Use well-known exonyms ("Moscow, Russia", "Kyiv, Ukraine", ...).
- Never add extra fields; return ONLY valid JSON.
`;

function strip(raw) {
  return (raw || '')
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();
}

export async function normalizeLocation(rawText) {
  const cli = getClient();
  if (!cli) {
    const t = (rawText || '').trim();
    return {
      city: t || null,
      country: null,
      confidence: 0.3,
      needsCity: false,
      needsCountry: true,
      normalized: t || null,
      note: 'fallback_no_llm'
    };
  }

  const resp = await cli.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0,
    messages: [
      { role: 'system', content: NORMALIZER_SYS },
      { role: 'user', content: `User input: ${rawText}` }
    ]
  });

  const payload = strip(resp.choices?.[0]?.message?.content || '{}');
  try {
    const json = JSON.parse(payload);
    return {
      city: json.city ?? null,
      country: json.country ?? null,
      confidence: typeof json.confidence === 'number' ? json.confidence : 0.5,
      needsCity: Boolean(json.needsCity),
      needsCountry: Boolean(json.needsCountry),
      normalized:
        json.normalized ?? (json.city && json.country ? `${json.city}, ${json.country}` : null),
      note: json.note ?? null
    };
  } catch {
    return {
      city: null,
      country: null,
      confidence: 0,
      needsCity: false,
      needsCountry: false,
      normalized: null,
      note: 'parse_error'
    };
  }
}

const VALIDATOR_SYS = `
You validate if a given City and Country exist in the real world.
Return STRICT JSON:
{
  "isCityValid": boolean,
  "isCountryValid": boolean,
  "confidence": number,
  "cityCanonical": string|null,
  "countryCanonical": string|null,
  "note": string|null
}
Rules:
- If you detect a typo and can fix confidently, set valid=true and provide canonical names.
- If ambiguous or unknown, set valid=false and confidence low.
- Answer ONLY JSON.
`;

export async function validateGeo(city, country) {
  const cli = getClient();
  if (!cli) {
    const okCity = !!(city && city.length >= 2);
    const okCountry = !!(country && country.length >= 2);
    return {
      isCityValid: okCity,
      isCountryValid: okCountry,
      confidence: okCity && okCountry ? 0.6 : 0.3,
      cityCanonical: city || null,
      countryCanonical: country || null,
      note: 'fallback_no_llm'
    };
  }

  const payload = { city: city || null, country: country || null };
  const resp = await cli.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0,
    messages: [
      { role: 'system', content: VALIDATOR_SYS },
      { role: 'user', content: JSON.stringify(payload) }
    ]
  });

  const txt = strip(resp.choices?.[0]?.message?.content || '{}');
  try {
    const json = JSON.parse(txt);
    return {
      isCityValid: !!json.isCityValid,
      isCountryValid: !!json.isCountryValid,
      confidence: typeof json.confidence === 'number' ? json.confidence : 0.5,
      cityCanonical: json.cityCanonical ?? city ?? null,
      countryCanonical: json.countryCanonical ?? country ?? null,
      note: json.note ?? null
    };
  } catch {
    return {
      isCityValid: false,
      isCountryValid: false,
      confidence: 0,
      cityCanonical: city || null,
      countryCanonical: country || null,
      note: 'parse_error'
    };
  }
}

const COMMON_CITY_TO_COUNTRY = {
  amsterdam: 'Netherlands',
  rotterdam: 'Netherlands',
  paris: 'France',
  lyon: 'France',
  berlin: 'Germany',
  munich: 'Germany',
  'münchen': 'Germany',
  barcelona: 'Spain',
  madrid: 'Spain',
  lisbon: 'Portugal',
  porto: 'Portugal',
  rome: 'Italy',
  milano: 'Italy',
  milan: 'Italy',
  london: 'United Kingdom',
  manchester: 'United Kingdom',
  kyiv: 'Ukraine',
  kiev: 'Ukraine',
  warsaw: 'Poland',
  krakow: 'Poland',
  istanbul: 'Turkey',
  'new york': 'United States',
  'los angeles': 'United States',
  'san francisco': 'United States'
};

async function guessCountryByCity(city) {
  if (!city) return null;
  const key = city.toLowerCase().trim();
  if (COMMON_CITY_TO_COUNTRY[key]) return COMMON_CITY_TO_COUNTRY[key];

  const cli = getClient();
  if (!cli) return null;

  const SYS = `Given a city name, answer ONLY the country's canonical English name, or "null" if unknown. Examples: "Amsterdam" -> "Netherlands", "Kiev" -> "Ukraine".`;
  const resp = await cli.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0,
    messages: [
      { role: 'system', content: SYS },
      { role: 'user', content: String(city) }
    ]
  });

  const raw = (resp.choices?.[0]?.message?.content || '').trim();
  if (/^null$/i.test(raw)) return null;
  return raw.replace(/^"+|"+$/g, '');
}

export async function resolveLocationFreeform(text, hintCountry = null, hintCity = null) {
  const parsed = await normalizeLocation(text);
  let city = parsed.city || hintCity || null;
  let country = parsed.country || hintCountry || null;

  if (city && !country) {
    const guessed = await guessCountryByCity(city);
    if (guessed) country = guessed;
  }

  if (city && country) {
    const validation = await validateGeo(city, country);
    if (validation.isCityValid && validation.isCountryValid && validation.confidence >= 0.6) {
      return {
        status: 'ok',
        city: validation.cityCanonical || city,
        country: validation.countryCanonical || country
      };
    }
    return {
      status: 'ask_again',
      message: 'Не уверен в локации. Укажи ещё раз в формате "Город, Страна". Например: "Porto, Portugal"'
    };
  }

  if (!city && country) {
    const validation = await validateGeo(null, country);
    if (validation.isCountryValid || validation.confidence >= 0.6) {
      return {
        status: 'need_city',
        country: validation.countryCanonical || country,
        message: `Ок, страна "${validation.countryCanonical || country}". Какой город?`
      };
    }
    return {
      status: 'ask_again',
      message: 'Страну не распознал. Укажи ещё раз, например: "Paris, France".'
    };
  }

  if (city && !country) {
    return {
      status: 'ask_again',
      message: `Город "${city}" понял, а страну не распознал. Напиши так: "Город, Страна".`
    };
  }

  return {
    status: 'ask_again',
    message: 'Не понял локацию. Напиши в формате "Город, Страна".'
  };
}
