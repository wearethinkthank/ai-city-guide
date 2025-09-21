export const RecCategory = {
  MUSIC: 'music',
  ART: 'art',
  CINEMA: 'cinema',
  FOOD: 'food',
  SPORTS: 'sports',
  OTHER: 'other'
};

/**
 * UnifiedRec
 * {
 *   id: string,
 *   provider: string,
 *   title: string,
 *   category: 'music'|'art'|'cinema'|'food'|'sports'|'other',
 *   start: string,
 *   end: string|null,
 *   venue: { name, address, city, country, lat, lon },
 *   priceFrom: number|null,
 *   priceCurrency: string|null,
 *   tags: string[],
 *   url: string,
 *   confidence: number,
 *   images?: string[]
 * }
 */
