import OpenAI from 'openai';

let client;
export function getOpenAI() {
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

export async function friendlyReply(userText) {
  // Fallback, если ключа нет
  if (!process.env.OPENAI_API_KEY) {
    return 'Пока нет доступа к OpenAI. Добавь OPENAI_API_KEY в .env';
  }

  const system = `Ты дружелюбный ассистент-турпланировщик. Отвечай кратко, тепло и по делу.`;
  const openai = getOpenAI();

  const resp = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.4,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: userText }
    ]
  });

  return resp.choices?.[0]?.message?.content?.trim() || 'Ок!';
}
