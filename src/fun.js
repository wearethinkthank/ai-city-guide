import OpenAI from 'openai';

let client;
function getClient() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  if (!client) client = new OpenAI({ apiKey: key });
  return client;
}

const SYS = `
You create a short funny 2-4 word nickname describing a person's tastes (music, food, art, cinema).
Output ONLY the nickname in Russian. Make it playful but kind. No quotes.
Examples:
- techno + mexican food -> "Буррито с прямой бочкой"
- jazz + sushi -> "Свингующий нигири"
- impressionism + pasta -> "Фетуччине Моне"
`;

export async function funDescription(user) {
  const cli = getClient();
  const seed = {
    music: user.music || user.musicRaw || null,
    cuisine: user.cuisine || user.cuisineRaw || null,
    art: user.art || user.artRaw || null,
    cinema: user.cinema || user.cinemaRaw || null
  };

  if (!cli) {
    const musicRaw = JSON.stringify(user.music || user.musicRaw || '').toLowerCase();
    const foodRaw = JSON.stringify(user.cuisine || user.cuisineRaw || '').toLowerCase();
    if (musicRaw.includes('techno')) {
      if (foodRaw.includes('mex') || foodRaw.includes('тако') || foodRaw.includes('мекс')) {
        return 'Буррито с прямой бочкой';
      }
      return 'Клубный лис';
    }
    if (musicRaw.includes('jazz')) {
      return 'Свингующий гурман';
    }
    return 'Гурман городских вайбов';
  }

  const resp = await cli.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.5,
    messages: [
      { role: 'system', content: SYS },
      { role: 'user', content: JSON.stringify(seed) }
    ]
  });

  const text = (resp.choices?.[0]?.message?.content || '').trim();
  return text || 'Гурман городских вайбов';
}
