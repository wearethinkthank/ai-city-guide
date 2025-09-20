import crypto from 'node:crypto';
import { RecCategory } from './recs.schema.js';

function id(provider, key) {
  return crypto.createHash('sha1').update(`${provider}:${key}`).digest('hex').slice(0, 16);
}

export async function searchMock({ city, country, start, end, tags, budgetEUR }) {
  const base = [
    {
      title: 'Late Night Jazz Session',
      category: RecCategory.MUSIC,
      venue: { name: 'Blue Note', city, country },
      priceFrom: 25,
      url: 'https://example.com/jazz'
    },
    {
      title: 'Impressionism Highlights',
      category: RecCategory.ART,
      venue: { name: 'City Museum', city, country },
      priceFrom: 15,
      url: 'https://example.com/art'
    },
    {
      title: 'Indie Film Screening',
      category: RecCategory.CINEMA,
      venue: { name: 'Indie Cinema', city, country },
      priceFrom: 12,
      url: 'https://example.com/indie'
    }
  ];

  const withinBudget = (item) =>
    !budgetEUR || !item.priceFrom || item.priceFrom <= budgetEUR / 3;

  return base
    .filter(withinBudget)
    .map((item, index) => {
      const startAt = start || new Date().toISOString();
      return {
        id: id('mock', `${item.title}-${index}-${startAt}-${end || ''}`),
        provider: 'mock',
        title: item.title,
        category: item.category,
        start: startAt,
        end: null,
        venue: {
          name: item.venue.name,
          address: null,
          city,
          country,
          lat: null,
          lon: null
        },
        priceFrom: item.priceFrom,
        priceCurrency: process.env.RECS_DEFAULT_CURRENCY || 'EUR',
        tags,
        url: item.url,
        confidence: 0.6 + 0.1 * index
      };
    });
}
