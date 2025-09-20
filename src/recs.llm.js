import OpenAI from 'openai';

let client;
function getClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  if (!client) client = new OpenAI({ apiKey });
  return client;
}

const SYS = `You expand user cultural tastes (music/cuisine/art/cinema/sports) into search tags.
Return strictly JSON:
{
  "music": string[],
  "art": string[],
  "cinema": string[],
  "food": string[],
  "sports": string[]
}
Rules:
- Short, lowercase, deduplicated, English where possible.
- Include synonyms (e.g. "duke ellington" -> "swing", "big band", "jazz").
- 3..10 items per field if known; empty arrays if unknown.
`;

export async function expandTastes(user) {
  const cli = getClient();
  if (!cli) {
    const pick = (arr) =>
      Array.isArray(arr)
        ? arr
            .map((x) => (x?.genre || x?.type || x || '') + '')
            .filter(Boolean)
            .map((s) => s.toLowerCase())
            .slice(0, 5)
        : [];
    return {
      music: pick(user.music),
      art: pick(user.art),
      cinema: pick(user.cinema),
      food: pick(user.cuisine),
      sports: []
    };
  }

  const payload = {
    music: user.music || [],
    art: user.art || [],
    cinema: user.cinema || [],
    food: user.cuisine || [],
    sports: user.sports || [],
    budget: user.budget || null
  };

  const resp = await cli.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0,
    messages: [
      { role: 'system', content: SYS },
      { role: 'user', content: JSON.stringify(payload) }
    ]
  });

  const txt = (resp.choices?.[0]?.message?.content || '{}')
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();
  try {
    const parsed = JSON.parse(txt);
    return {
      music: Array.isArray(parsed.music) ? parsed.music : [],
      art: Array.isArray(parsed.art) ? parsed.art : [],
      cinema: Array.isArray(parsed.cinema) ? parsed.cinema : [],
      food: Array.isArray(parsed.food) ? parsed.food : [],
      sports: Array.isArray(parsed.sports) ? parsed.sports : []
    };
  } catch {
    return { music: [], art: [], cinema: [], food: [], sports: [] };
  }
}
