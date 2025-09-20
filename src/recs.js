import { prisma } from './db.js';
import { expandTastes } from './recs.llm.js';
import { searchMock } from './recs.providers.mock.js';

function toISO(value) {
  try {
    return value ? new Date(value).toISOString() : null;
  } catch {
    return null;
  }
}

function budgetToEUR(text) {
  if (!text) return null;
  const match = String(text).match(/(\d+[.,]?\d*)\s*(€|eur|euro|\$|usd|₽|rub|руб|£|gbp|₸|kzt|₴|uah)?/i);
  if (!match) return null;
  const value = parseFloat(match[1].replace(',', '.'));
  const currency = (match[2] || 'EUR').toUpperCase();
  const rateMap = {
    EUR: 1,
    $: 1.07,
    USD: 1.07,
    RUB: 0.01,
    GBP: 1.17,
    UAH: 0.025,
    KZT: 0.002
  };
  const rate = rateMap[currency] || 1;
  return Math.round(value * rate);
}

export async function recommendForUser(userId, limit = 20) {
  const user = await prisma.user.findUnique({ where: { id: String(userId) } });
  if (!user) return { items: [], reason: 'no_user' };

  const city = user.city || null;
  const country = user.country || null;
  const start = user.dates?.start ? toISO(user.dates.start) : null;
  const end = user.dates?.end ? toISO(user.dates.end) : null;
  const budgetEUR = budgetToEUR(user.budget);

  const expanded = await expandTastes(user);
  const tags = [
    ...(expanded.music || []),
    ...(expanded.art || []),
    ...(expanded.cinema || []),
    ...(expanded.food || []),
    ...(expanded.sports || [])
  ]
    .map((tag) => String(tag || '').trim().toLowerCase())
    .filter(Boolean);
  const uniqueTags = [...new Set(tags)].slice(0, 20);

  const useReal = process.env.RECS_ENABLE_REAL === '1';
  let results = [];
  results.push(
    ...(await searchMock({
      city,
      country,
      start,
      end,
      tags: uniqueTags,
      budgetEUR
    }))
  );

  // TODO: add real providers when available (Songkick, Ticketmaster, etc.)

  results.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));

  const seen = new Set();
  const items = [];
  for (const candidate of results) {
    const key = `${candidate.title || ''}|${candidate.start || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(candidate);
    if (items.length >= limit) break;
  }

  return {
    items,
    meta: { city, country, start, end, budgetEUR, tags: uniqueTags, useReal }
  };
}
