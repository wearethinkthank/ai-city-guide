// Лёгкий парсер диапазона дат “from — to” с нормализацией в YYYY-MM-DD.
// Поддерживает широкий спектр форматов: 2025-10-12 — 2025-10-18, 12.10.2025-18.10.2025,
// 12-18.10.2025, 12-18 Oct 2025, 12-18 октября 2025, "с 12 по 18 октября", "с 25 октября до 4 ноября",
// "25 28 декабря", "13-15.10", "с 1 по 6 января" и т.п.

const MONTHS = {
  // RU
  'янв': 1,
  'январь': 1,
  'января': 1,
  'фев': 2,
  'февраль': 2,
  'февраля': 2,
  'мар': 3,
  'март': 3,
  'марта': 3,
  'апр': 4,
  'апрель': 4,
  'апреля': 4,
  'май': 5,
  'мая': 5,
  'июн': 6,
  'июнь': 6,
  'июня': 6,
  'июл': 7,
  'июль': 7,
  'июля': 7,
  'авг': 8,
  'август': 8,
  'августа': 8,
  'сен': 9,
  'сентябрь': 9,
  'сентября': 9,
  'oct': 10,
  'окт': 10,
  'октябрь': 10,
  'октября': 10,
  'ноя': 11,
  'ноябрь': 11,
  'ноября': 11,
  'дек': 12,
  'декабрь': 12,
  'декабря': 12,
  // EN
  'jan': 1,
  'january': 1,
  'feb': 2,
  'february': 2,
  'mar': 3,
  'march': 3,
  'apr': 4,
  'april': 4,
  'may': 5,
  'jun': 6,
  'june': 6,
  'jul': 7,
  'july': 7,
  'aug': 8,
  'august': 8,
  'sep': 9,
  'sept': 9,
  'september': 9,
  'oct': 10,
  'october': 10,
  'nov': 11,
  'november': 11,
  'dec': 12,
  'december': 12
};

function pad(n) {
  return String(n).padStart(2, '0');
}
function toISO(y, m, d) {
  return `${y}-${pad(m)}-${pad(d)}`;
}

function parseISOParts(iso) {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return { year: +match[1], month: +match[2], day: +match[3] };
}

// Парсинг одной даты из разных форматов
function parseOneDate(token, fallbackYear) {
  token = token.trim().toLowerCase();
  if (!token) return null;

  let m = token.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return toISO(+m[1], +m[2], +m[3]);

  m = token.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (m) return toISO(+m[3], +m[2], +m[1]);

  m = token.match(/^(\d{1,2})[./-](\d{1,2})$/);
  if (m && fallbackYear) return toISO(fallbackYear, +m[2], +m[1]);

  m = token.match(/^(\d{1,2})\s+([a-zа-яё]+)\s+(\d{4})$/i);
  if (m) {
    const month = resolveMonth(m[2]);
    if (month) return toISO(+m[3], month, +m[1]);
  }

  m = token.match(/^(\d{1,2})\s+([a-zа-яё]+)$/i);
  if (m && fallbackYear) {
    const month = resolveMonth(m[2]);
    if (month) return toISO(fallbackYear, month, +m[1]);
  }

  return null;
}

function resolveMonth(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  return MONTHS[lower] || MONTHS[lower.slice(0, 3)] || null;
}

function compareOrder(a, b) {
  return a <= b ? { start: a, end: b } : { start: b, end: a };
}

function splitByFirstDash(norm) {
  const tokens = norm.split('-');
  if (tokens.length < 2) return null;
  for (let i = 1; i < tokens.length; i += 1) {
    const left = tokens.slice(0, i).join('-');
    const right = tokens.slice(i).join('-');
    if (left.trim() && right.trim()) {
      return { left: left.trim(), right: right.trim() };
    }
  }
  return null;
}

// Специальный случай: "25 28 декабря" или "25 28 dec 2025"
function parseSameMonthRange(norm) {
  const match = norm.match(/^(\d{1,2})\s+(\d{1,2})\s+([a-zа-яё]+)(?:\s+(20\d{2}))?$/i);
  if (!match) return null;
  const d1 = +match[1];
  const d2 = +match[2];
  const month = resolveMonth(match[3]);
  if (!month) return null;
  const year = match[4] ? +match[4] : new Date().getFullYear();
  const start = toISO(year, month, Math.min(d1, d2));
  const end = toISO(year, month, Math.max(d1, d2));
  return { start, end };
}

// Выделяем два конца диапазона из “строки целиком”
export function parseDateRangeFlexible(text) {
  const norm = text
    .replace(/с\s+/gi, '')
    .replace(/\s+по\s+/gi, '-')
    .replace(/\s+до\s+/gi, '-')
    .replace(/to/gi, '-')
    .replace(/–|—/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

  if (!norm) return null;

  const sameMonth = parseSameMonthRange(norm);
  if (sameMonth) return sameMonth;

  const isoMatch = norm.match(/(\d{4}-\d{2}-\d{2})\s*-\s*(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) {
    return compareOrder(isoMatch[1], isoMatch[2]);
  }

  const isoCompact = norm.match(/(\d{4}-\d{2}-\d{2})-(\d{4}-\d{2}-\d{2})/);
  if (isoCompact) {
    return compareOrder(isoCompact[1], isoCompact[2]);
  }

  const spacedDash = norm.indexOf(' - ');
  let left;
  let right;

  if (spacedDash !== -1) {
    left = norm.slice(0, spacedDash).trim();
    right = norm.slice(spacedDash + 3).trim();
  } else {
    const split = splitByFirstDash(norm);
    if (!split) {
      const yearSingle = new Date().getFullYear();
      const single = parseOneDate(norm, yearSingle);
      if (!single) return null;
      return { start: single, end: single };
    }
    left = split.left;
    right = split.right;
  }

  const yRight = (right.match(/(20\d{2})/) || [])[1];
  const fallbackYear = yRight ? +yRight : new Date().getFullYear();

  const mDMYRight = right.match(/^(\d{1,2})[./-](\d{1,2})(?:[./-](\d{4}))?$/);
  if (mDMYRight) {
    const d2 = +mDMYRight[1];
    const mo = +mDMYRight[2];
    const yy = mDMYRight[3] ? +mDMYRight[3] : fallbackYear;
    const isoEnd = toISO(yy, mo, d2);

    const mDLeft = left.match(/^(\d{1,2})$/);
    if (mDLeft) {
      const d1 = +mDLeft[1];
      const isoStart = toISO(yy, mo, d1);
      return compareOrder(isoStart, isoEnd);
    }
  }

  const startISOInitial = parseOneDate(left, fallbackYear);
  let endISO = parseOneDate(right, fallbackYear);
  let startISO = startISOInitial;

  if (!endISO && /^\d{1,2}$/.test(right) && startISOInitial) {
    const parts = parseISOParts(startISOInitial);
    if (parts) {
      endISO = toISO(parts.year, parts.month, +right);
    }
  }

  if (!startISO && /^\d{1,2}$/.test(left) && endISO) {
    const parts = parseISOParts(endISO);
    if (parts) {
      startISO = toISO(parts.year, parts.month, +left);
    }
  }

  if (!startISO || !endISO) return null;

  return compareOrder(startISO, endISO);
}
