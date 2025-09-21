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

function imgSet(seedBase) {
  return [
    `https://picsum.photos/seed/${encodeURIComponent(seedBase)}-1/800/500`,
    `https://picsum.photos/seed/${encodeURIComponent(seedBase)}-2/800/500`,
    `https://picsum.photos/seed/${encodeURIComponent(seedBase)}-3/800/500`
  ];
}

const CATALOG = {
  [RecCategory.MUSIC]: [
    { t: 'Late Night Jazz Session', v: 'Blue Note', p: 25, u: 'https://example.com/jazz1', imgs: imgSet('music-jazz') },
    { t: 'Techno Warehouse', v: 'Block Club', p: 30, u: 'https://example.com/techno1', imgs: imgSet('music-techno') },
    { t: 'Indie Folk Evening', v: 'Green Hall', p: 18, u: 'https://example.com/folk1', imgs: imgSet('music-folk') },
    { t: 'Funk & Soul Night', v: 'Groove Bar', p: 22, u: 'https://example.com/funk1', imgs: imgSet('music-funk') },
    { t: 'Big Band Tribute', v: 'Town Theatre', p: 28, u: 'https://example.com/bigband1', imgs: imgSet('music-bigband') },
    { t: 'House Rooftop', v: 'Skyline', p: 20, u: 'https://example.com/house1', imgs: imgSet('music-house') },
    { t: 'Classical Quartet', v: 'Philharmonia', p: 15, u: 'https://example.com/classic1', imgs: imgSet('music-classical') },
    { t: 'Rap Battles', v: 'Underground', p: 12, u: 'https://example.com/rap1', imgs: imgSet('music-rap') },
    { t: 'Lo-fi Beats Live', v: 'Chill Spot', p: 10, u: 'https://example.com/lofi1', imgs: imgSet('music-lofi') }
  ],
  [RecCategory.ART]: [
    { t: 'Impressionism Highlights', v: 'City Museum', p: 15, u: 'https://example.com/art1', imgs: imgSet('art-impressionism') },
    { t: 'Modern Art Pop-up', v: 'Depot 12', p: 12, u: 'https://example.com/art2', imgs: imgSet('art-modern') },
    { t: 'Photography Biennale', v: 'Expo Hall', p: 14, u: 'https://example.com/art3', imgs: imgSet('art-photo') },
    { t: 'Street Art Tour', v: 'Old District', p: 9, u: 'https://example.com/art4', imgs: imgSet('art-street') },
    { t: 'Sculpture Garden', v: 'Park Gallery', p: 8, u: 'https://example.com/art5', imgs: imgSet('art-sculpture') },
    { t: 'Renaissance Gems', v: 'National Gallery', p: 17, u: 'https://example.com/art6', imgs: imgSet('art-renaissance') },
    { t: 'Digital Immersive', v: 'Immersive Lab', p: 20, u: 'https://example.com/art7', imgs: imgSet('art-digital') },
    { t: 'Watercolor Workshop', v: 'Atelier', p: 11, u: 'https://example.com/art8', imgs: imgSet('art-watercolor') },
    { t: 'Avant-garde Night', v: 'Cube', p: 13, u: 'https://example.com/art9', imgs: imgSet('art-avantgarde') }
  ],
  [RecCategory.CINEMA]: [
    { t: 'Indie Film Screening', v: 'Indie Cinema', p: 12, u: 'https://example.com/cine1', imgs: imgSet('cinema-indie') },
    { t: 'Documentary Night', v: 'Docu Club', p: 10, u: 'https://example.com/cine2', imgs: imgSet('cinema-docu') },
    { t: 'Cult Classics', v: 'Retro Hall', p: 9, u: 'https://example.com/cine3', imgs: imgSet('cinema-cult') },
    { t: 'Animation Shorts', v: 'Art House', p: 8, u: 'https://example.com/cine4', imgs: imgSet('cinema-animation') },
    { t: 'Director Spotlight', v: 'Studio 4', p: 11, u: 'https://example.com/cine5', imgs: imgSet('cinema-director') },
    { t: 'Horror Marathon', v: 'Night Owl', p: 13, u: 'https://example.com/cine6', imgs: imgSet('cinema-horror') },
    { t: 'Festival Preview', v: 'Grand', p: 14, u: 'https://example.com/cine7', imgs: imgSet('cinema-festival') },
    { t: 'Local Filmmakers', v: 'Community', p: 6, u: 'https://example.com/cine8', imgs: imgSet('cinema-local') },
    { t: 'Silent Movie Live Score', v: 'Opera House', p: 16, u: 'https://example.com/cine9', imgs: imgSet('cinema-silent') }
  ],
  [RecCategory.FOOD]: [
    { t: 'Taco Crawl', v: 'Centro', p: 20, u: 'https://example.com/food1', imgs: imgSet('food-taco') },
    { t: 'Ramen Night', v: 'Hokkaido Bar', p: 18, u: 'https://example.com/food2', imgs: imgSet('food-ramen') },
    { t: 'Wine & Cheese', v: 'Cave 42', p: 25, u: 'https://example.com/food3', imgs: imgSet('food-winecheese') },
    { t: 'Neapolitan Pizza Lab', v: 'Oven Lab', p: 16, u: 'https://example.com/food4', imgs: imgSet('food-pizza') },
    { t: 'Vegan Brunch', v: 'Leafy', p: 14, u: 'https://example.com/food5', imgs: imgSet('food-vegan') },
    { t: 'BBQ Backyard', v: 'Smoky', p: 22, u: 'https://example.com/food6', imgs: imgSet('food-bbq') },
    { t: 'Tapas Trail', v: 'Barrio', p: 19, u: 'https://example.com/food7', imgs: imgSet('food-tapas') },
    { t: 'Coffee Cupping', v: 'Roastery', p: 8, u: 'https://example.com/food8', imgs: imgSet('food-coffee') },
    { t: 'Pastry Class', v: 'Pâtisserie', p: 12, u: 'https://example.com/food9', imgs: imgSet('food-pastry') }
  ],
  [RecCategory.SPORTS]: [
    { t: 'Basketball Open Gym', v: 'Court A', p: 7, u: 'https://example.com/sport1', imgs: imgSet('sports-basketball') },
    { t: 'City Run 10K', v: 'Riverside', p: 0, u: 'https://example.com/sport2', imgs: imgSet('sports-run') },
    { t: 'Climbing Session', v: 'Boulder Hub', p: 15, u: 'https://example.com/sport3', imgs: imgSet('sports-climb') },
    { t: 'Yoga in Park', v: 'Green Park', p: 5, u: 'https://example.com/sport4', imgs: imgSet('sports-yoga') },
    { t: 'Amateur Football', v: 'Stadium 2', p: 6, u: 'https://example.com/sport5', imgs: imgSet('sports-football') },
    { t: 'Table Tennis Meetup', v: 'Rec Center', p: 4, u: 'https://example.com/sport6', imgs: imgSet('sports-pingpong') },
    { t: 'Swim Evening', v: 'Aquatics', p: 9, u: 'https://example.com/sport7', imgs: imgSet('sports-swim') },
    { t: 'Cycling Club Ride', v: 'Old Bridge', p: 0, u: 'https://example.com/sport8', imgs: imgSet('sports-cycle') },
    { t: 'Boxing Basics', v: 'Ring Club', p: 12, u: 'https://example.com/sport9', imgs: imgSet('sports-boxing') }
  ],
  [RecCategory.OTHER]: [
    { t: 'Stand-up Night', v: 'Laugh Bar', p: 12, u: 'https://example.com/oth1', imgs: imgSet('other-standup') },
    { t: 'Board Games Meetup', v: 'Tabletop', p: 5, u: 'https://example.com/oth2', imgs: imgSet('other-boardgames') },
    { t: 'Language Exchange', v: 'Café Polyglot', p: 0, u: 'https://example.com/oth3', imgs: imgSet('other-language') },
    { t: 'Improvisation Jam', v: 'Studio 9', p: 10, u: 'https://example.com/oth4', imgs: imgSet('other-improv') },
    { t: 'Book Club', v: 'Library', p: 0, u: 'https://example.com/oth5', imgs: imgSet('other-bookclub') },
    { t: 'Karaoke Bash', v: 'SingAlong', p: 8, u: 'https://example.com/oth6', imgs: imgSet('other-karaoke') },
    { t: 'Photography Walk', v: 'Old Town', p: 0, u: 'https://example.com/oth7', imgs: imgSet('other-photowalk') },
    { t: 'Crafts Workshop', v: 'Makers Lab', p: 9, u: 'https://example.com/oth8', imgs: imgSet('other-crafts') },
    { t: 'Startup Pitch Night', v: 'Hub', p: 0, u: 'https://example.com/oth9', imgs: imgSet('other-startup') }
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
        images: Array.isArray(item.imgs) ? item.imgs : [],
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
