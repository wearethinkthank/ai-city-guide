import OpenAI from 'openai';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM = `
You are a location normalizer. Task: infer CITY and COUNTRY from a free-text user input.
Return STRICT JSON:

{
  "city": string|null,        // English or widely used Latin transliteration
  "country": string|null,     // English country name
  "confidence": number,       // 0..1
  "needsCity": boolean,       // true if only country detected or city ambiguous
  "needsCountry": boolean,    // true if only city detected or country ambiguous
  "normalized": string|null,  // e.g. "Berlin, Germany" if both known
  "note": string|null         // short reasoning or disambiguation hint
}

Rules:
- Fix typos (e.g., "Amstrdam" -> "Amsterdam").
- If user gives only country: set needsCity=true.
- If user gives only city: infer most common country; if ambiguous (e.g., "Springfield"), set needsCountry=true.
- Use well-known exonyms (e.g., "Moscow, Russia", "Kyiv, Ukraine", "New York, United States").
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
  if (!process.env.OPENAI_API_KEY) {
    const t = (rawText || '').trim();
    return {
      city: t || null,
      country: null,
      confidence: 0.3,
      needsCity: false,
      needsCountry: true,
      normalized: t || null,
      note: 'No OpenAI key, simple passthrough.'
    };
  }

  const resp = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0,
    messages: [
      { role: 'system', content: SYSTEM },
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
        json.normalized ??
        (json.city && json.country ? `${json.city}, ${json.country}` : null),
      note: json.note ?? null
    };
  } catch (error) {
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
  } catch (error) {
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
