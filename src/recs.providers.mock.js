import crypto from 'node:crypto';
import { RecCategory } from './recs.schema.js';

function id(provider, key) {
  return crypto.createHash('sha1').update(`${provider}:${key}`).digest('hex').slice(0, 16);
}

function isoNowPlus(days = 0) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

const CATALOG = {
  [RecCategory.MUSIC]: [
    { t: 'Late Night Jazz Session', v: 'Blue Note', p: 25, u: 'https://example.com/jazz1' },
    { t: 'Techno Warehouse', v: 'Block Club', p: 30, u: 'https://example.com/techno1' },
    { t: 'Indie Folk Evening', v: 'Green Hall', p: 18, u: 'https://example.com/folk1' },
    { t: 'Funk & Soul Night', v: 'Groove Bar', p: 22, u: 'https://example.com/funk1' },
    { t: 'Big Band Tribute', v: 'Town Theatre', p: 28, u: 'https://example.com/bigband1' },
    { t: 'House Rooftop', v: 'Skyline', p: 20, u: 'https://example.com/house1' },
    { t: 'Classical Quartet', v: 'Philharmonia', p: 15, u: 'https://example.com/classic1' },
    { t: 'Rap Battles', v: 'Underground', p: 12, u: 'https://example.com/rap1' },
    { t: 'Lo-fi Beats Live', v: 'Chill Spot', p: 10, u: 'https://example.com/lofi1' }
  ],
  [RecCategory.ART]: [
    { t: 'Impressionism Highlights', v: 'City Museum', p: 15, u: 'https://example.com/art1' },
    { t: 'Modern Art Pop-up', v: 'Depot 12', p: 12, u: 'https://example.com/art2' },
    { t: 'Photography Biennale', v: 'Expo Hall', p: 14, u: 'https://example.com/art3' },
    { t: 'Street Art Tour', v: 'Old District', p: 9, u: 'https://example.com/art4' },
    { t: 'Sculpture Garden', v: 'Park Gallery', p: 8, u: 'https://example.com/art5' },
    { t: 'Renaissance Gems', v: 'National Gallery', p: 17, u: 'https://example.com/art6' },
    { t: 'Digital Immersive', v: 'Immersive Lab', p: 20, u: 'https://example.com/art7' },
    { t: 'Watercolor Workshop', v: 'Atelier', p: 11, u: 'https://example.com/art8' },
    { t: 'Avant-garde Night', v: 'Cube', p: 13, u: 'https://example.com/art9' }
  ],
  [RecCategory.CINEMA]: [
    { t: 'Indie Film Screening', v: 'Indie Cinema', p: 12, u: 'https://example.com/cine1' },
    { t: 'Documentary Night', v: 'Docu Club', p: 10, u: 'https://example.com/cine2' },
    { t: 'Cult Classics', v: 'Retro Hall', p: 9, u: 'https://example.com/cine3' },
    { t: 'Animation Shorts', v: 'Art House', p: 8, u: 'https://example.com/cine4' },
    { t: 'Director Spotlight', v: 'Studio 4', p: 11, u: 'https://example.com/cine5' },
    { t: 'Horror Marathon', v: 'Night Owl', p: 13, u: 'https://example.com/cine6' },
    { t: 'Festival Preview', v: 'Grand', p: 14, u: 'https://example.com/cine7' },
    { t: 'Local Filmmakers', v: 'Community', p: 6, u: 'https://example.com/cine8' },
    { t: 'Silent Movie Live Score', v: 'Opera House', p: 16, u: 'https://example.com/cine9' }
  ],
  [RecCategory.FOOD]: [
    { t: 'Taco Crawl', v: 'Centro', p: 20, u: 'https://example.com/food1' },
    { t: 'Ramen Night', v: 'Hokkaido Bar', p: 18, u: 'https://example.com/food2' },
    { t: 'Wine & Cheese', v: 'Cave 42', p: 25, u: 'https://example.com/food3' },
    { t: 'Neapolitan Pizza Lab', v: 'Oven Lab', p: 16, u: 'https://example.com/food4' },
    { t: 'Vegan Brunch', v: 'Leafy', p: 14, u: 'https://example.com/food5' },
    { t: 'BBQ Backyard', v: 'Smoky', p: 22, u: 'https://example.com/food6' },
    { t: 'Tapas Trail', v: 'Barrio', p: 19, u: 'https://example.com/food7' },
    { t: 'Coffee Cupping', v: 'Roastery', p: 8, u: 'https://example.com/food8' },
    { t: 'Pastry Class', v: 'Pâtisserie', p: 12, u: 'https://example.com/food9' }
  ],
  [RecCategory.SPORTS]: [
    { t: 'Basketball Open Gym', v: 'Court A', p: 7, u: 'https://example.com/sport1' },
    { t: 'City Run 10K', v: 'Riverside', p: 0, u: 'https://example.com/sport2' },
    { t: 'Climbing Session', v: 'Boulder Hub', p: 15, u: 'https://example.com/sport3' },
    { t: 'Yoga in Park', v: 'Green Park', p: 5, u: 'https://example.com/sport4' },
    { t: 'Amateur Football', v: 'Stadium 2', p: 6, u: 'https://example.com/sport5' },
    { t: 'Table Tennis Meetup', v: 'Rec Center', p: 4, u: 'https://example.com/sport6' },
    { t: 'Swim Evening', v: 'Aquatics', p: 9, u: 'https://example.com/sport7' },
    { t: 'Cycling Club Ride', v: 'Old Bridge', p: 0, u: 'https://example.com/sport8' },
    { t: 'Boxing Basics', v: 'Ring Club', p: 12, u: 'https://example.com/sport9' }
  ],
  [RecCategory.OTHER]: [
    { t: 'Stand-up Night', v: 'Laugh Bar', p: 12, u: 'https://example.com/oth1' },
    { t: 'Board Games Meetup', v: 'Tabletop', p: 5, u: 'https://example.com/oth2' },
    { t: 'Language Exchange', v: 'Café Polyglot', p: 0, u: 'https://example.com/oth3' },
    { t: 'Improvisation Jam', v: 'Studio 9', p: 10, u: 'https://example.com/oth4' },
    { t: 'Book Club', v: 'Library', p: 0, u: 'https://example.com/oth5' },
    { t: 'Karaoke Bash', v: 'SingAlong', p: 8, u: 'https://example.com/oth6' },
    { t: 'Photography Walk', v: 'Old Town', p: 0, u: 'https://example.com/oth7' },
    { t: 'Crafts Workshop', v: 'Makers Lab', p: 9, u: 'https://example.com/oth8' },
    { t: 'Startup Pitch Night', v: 'Hub', p: 0, u: 'https://example.com/oth9' }
  ]
};

export async function searchMock({ city, country, start, tags, budgetEUR }) {
  const currency = process.env.RECS_DEFAULT_CURRENCY || 'EUR';
  const out = [];
  const startISO = start || isoNowPlus(1);

  const pick = (arr, category) => {
    for (let i = 0; i < arr.length; i += 1) {
      const item = arr[i];
      if (budgetEUR && item.p && item.p > Math.max(10, budgetEUR)) continue;
      out.push({
        id: id('mock', `${category}:${item.t}:${i}:${startISO}`),
        provider: 'mock',
        title: item.t,
        category,
        start: startISO,
        end: null,
        venue: {
          name: item.v,
          address: null,
          city: city || 'City',
          country: country || 'Country',
          lat: null,
          lon: null
        },
        priceFrom: item.p ?? null,
        priceCurrency: currency,
        tags: (tags || []).slice(0, 5),
        url: item.u,
        confidence: 0.55 + Math.random() * 0.35
      });
    }
  };

  pick(CATALOG[RecCategory.MUSIC], RecCategory.MUSIC);
  pick(CATALOG[RecCategory.ART], RecCategory.ART);
  pick(CATALOG[RecCategory.CINEMA], RecCategory.CINEMA);
  pick(CATALOG[RecCategory.FOOD], RecCategory.FOOD);
  pick(CATALOG[RecCategory.SPORTS], RecCategory.SPORTS);
  pick(CATALOG[RecCategory.OTHER], RecCategory.OTHER);

  return out.sort(() => Math.random() - 0.5);
}
