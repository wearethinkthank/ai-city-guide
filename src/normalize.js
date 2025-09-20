import OpenAI from 'openai';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM = `
Ты парсер предпочтений. Верни СТРОГИЙ JSON следующей формы:

{
  "music":   [{ "genre": string, "additional": string|null }],
  "art":     [{ "genre": string, "additional": string|null }],
  "cuisine": [{ "type":  string, "additional": string|null }],
  "sports":  [{ "type":  string, "additional": string|null }],
  "leisure": [{ "type":  string, "additional": string|null }],
  "cinema":  [{ "type":  string, "additional": string|null }]
}

Правила:
- Нормализуй названия жанров/направлений на английском (e.g., "jazz", "hip hop", "impressionism").
- Если пользователь упомянул конкретного артиста/режиссёра/повара/бренд — положи имя/уточнение в "additional".
  Пример: "люблю Дюка Эллингтона" -> music[0]: { "genre": "jazz", "additional": "Duke Ellington" }.
  Пример: "импрессионизм, особенно Кувшинки Моне" -> art[0]: { "genre": "impressionism", "additional": "особенно Кувшинки Моне" }.
- Если инфы по категории нет — верни пустой массив для этой категории.
- НЕ добавляй лишних полей. Возвращай ТОЛЬКО валидный JSON без комментариев и текста вокруг.
`;

function stripCodeFences(s) {
  if (!s) return s;
  return s
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();
}

export async function normalizeTastes(rawText) {
  if (!process.env.OPENAI_API_KEY) {
    // Fallback — пустые поля
    return { music: [], art: [], cuisine: [], sports: [], leisure: [], cinema: [] };
  }
  const user = `Извлеки предпочтения из текста:\n${rawText}`;

  const resp = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0,
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: user }
    ]
  });

  let content = resp.choices?.[0]?.message?.content ?? '{}';
  content = stripCodeFences(content);

  try {
    const parsed = JSON.parse(content);
    return {
      music: Array.isArray(parsed.music) ? parsed.music : [],
      art: Array.isArray(parsed.art) ? parsed.art : [],
      cuisine: Array.isArray(parsed.cuisine) ? parsed.cuisine : [],
      sports: Array.isArray(parsed.sports) ? parsed.sports : [],
      leisure: Array.isArray(parsed.leisure) ? parsed.leisure : [],
      cinema: Array.isArray(parsed.cinema) ? parsed.cinema : []
    };
  } catch {
    return { music: [], art: [], cuisine: [], sports: [], leisure: [], cinema: [] };
  }
}

const MUSIC_SYS = `
Ты парсер музыкальных предпочтений. Верни СТРОГИЙ JSON массива:
[ { "genre": string, "additional": string|null } ]
Правила:
- Нормализуй жанры на английском ("jazz", "hip hop", "techno", "ambient", "house", "indie rock", и т.п.).
- Если указан артист/лейбл/сцена — помести в "additional" (например, "Duke Ellington").
- Не добавляй лишних полей. Верни только JSON-массив.
`;

const CUISINE_SYS = `
Ты парсер гастрономических предпочтений. Верни СТРОГИЙ JSON массива:
[ { "type": string, "additional": string|null } ]
Правила:
- "type" нормализуй на английском ("sushi", "ramen", "georgian", "neapolitan pizza", "steakhouse", "tapas", "seafood", и т.п.).
- Конкретные бренды/блюда/повара клади в "additional".
- Верни только JSON-массив.
`;

const ART_SYS = `
Ты парсер предпочтений в искусстве. Верни СТРОГИЙ JSON массива:
[ { "genre": string, "additional": string|null } ]
Правила:
- "genre" нормализуй на английском ("impressionism", "expressionism", "modernism", "street art", и т.п.).
- Уточнения (например, "особенно Кувшинки Моне") клади в "additional".
- Верни только JSON-массив.
`;

const CINEMA_SYS = `
Ты парсер кино-предпочтений. Верни СТРОГИЙ JSON массива:
[ { "type": string, "additional": string|null } ]
Правила:
- "type" нормализуй на английском ("film noir", "arthouse", "sci-fi", "documentary", "anime", и т.п.).
- Конкретные режиссёры/фильмы/фестивали клади в "additional".
- Верни только JSON-массив.
`;

function stripArrayJson(s) {
  if (!s) return '[]';
  return stripCodeFences(s).trim();
}

async function chatStrictArray(system, user) {
  if (!process.env.OPENAI_API_KEY) return [];
  const resp = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ]
  });
  const raw = stripArrayJson(resp.choices?.[0]?.message?.content || '[]');
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export async function normalizeMusic(text) {
  return chatStrictArray(MUSIC_SYS, `Извлеки музыкальные предпочтения из текста:\n${text}`);
}
export async function normalizeCuisine(text) {
  return chatStrictArray(CUISINE_SYS, `Извлеки гастрономические предпочтения из текста:\n${text}`);
}
export async function normalizeArt(text) {
  return chatStrictArray(ART_SYS, `Извлеки художественные предпочтения из текста:\n${text}`);
}
export async function normalizeCinema(text) {
  return chatStrictArray(CINEMA_SYS, `Извлеки киновкусы из текста:\n${text}`);
}
