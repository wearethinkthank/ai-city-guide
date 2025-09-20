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
