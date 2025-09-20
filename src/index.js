import 'dotenv/config';

import express from 'express';
import rateLimit from 'express-rate-limit';
import { Markup, Telegraf } from 'telegraf';
import {
  normalizeMusic,
  normalizeCuisine,
  normalizeArt,
  normalizeCinema
} from './normalize.js';
import { normalizeLocation } from './location.js';
import { parseDateRangeFlexible } from './dates.js';
import { prisma, getOrCreateUser } from './db.js';
import { getUI, setUI, resetUI, pushScreen, popScreen } from './state.js';
import { friendlyReply } from './llm.js';

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.error('TELEGRAM_BOT_TOKEN is required');
  process.exit(1);
}

const app = express();
app.use(express.json());

const bot = new Telegraf(token);

const tgLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.headers['x-forwarded-for'] || req.ip
});

function verifyTelegramSecret(req, res, next) {
  const expected = process.env.TG_WEBHOOK_SECRET;
  if (!expected) return next();
  const got = req.get('X-Telegram-Bot-Api-Secret-Token');
  if (got && got === expected) return next();
  console.warn('[webhook] secret mismatch');
  return res.status(200).end();
}

app.use('/telegram', (req, _res, next) => {
  console.log('[webhook] hit', req.method, 'len=', req.headers['content-length'] || 0);
  next();
});

app.use('/telegram', tgLimiter);
app.use('/telegram', verifyTelegramSecret);
app.use('/telegram', bot.webhookCallback());

// --- Telegram Webhook helpers ---
async function getWebhookInfo(botToken) {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
  return res.json();
}

async function setWebhook(botToken, url) {
  const body = {
    url,
    secret_token: process.env.TG_WEBHOOK_SECRET || undefined,
    max_connections: 40,
    allowed_updates: ['message', 'callback_query']
  };
  const res = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

async function ensureWebhook(botInstance, _expressApp) {
  const url = process.env.WEBHOOK_URL;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!url || !botToken) {
    console.log('[webhook] WEBHOOK_URL or TELEGRAM_BOT_TOKEN not set — using long polling locally');
    await botInstance.launch();
    console.log('[bot] launched with long polling');
    return;
  }

  try {
    const info = await getWebhookInfo(botToken);
    const current = info?.result?.url || info?.url || info?.result?.hook || '';
    if (current !== url) {
      console.log('[webhook] different or empty, setting new webhook...');
      const resp = await setWebhook(botToken, url);
      console.log('[webhook] setWebhook response:', resp);
    } else {
      console.log('[webhook] already set to correct URL');
    }
  } catch (error) {
    console.error('[webhook] ensure error:', error);
  }
}

async function setupCommands(botInstance) {
  try {
    await botInstance.telegram.setMyCommands([
      { command: 'start', description: 'Начать заново' },
      { command: 'reset', description: 'Сбросить прогресс' },
      { command: 'where', description: 'Показать текущий шаг' },
      { command: 'profile', description: 'Показать профиль' },
      { command: 'profile_raw', description: 'Показать сырые ответы' }
    ]);
  } catch (error) {
    console.error('setMyCommands failed', error);
  }
}

setupCommands(bot);

bot.catch((err, ctx) => {
  console.error('[telegraf] error', err?.stack || err, 'on update', ctx?.update?.update_id);
});

async function deletePrevPrompt(ctx, userId) {
  const ui = getUI(userId);
  const chatId = ctx.chat?.id;
  const msgId = ui?.lastPromptId;
  if (!chatId || !msgId) return;
  try {
    await ctx.telegram.deleteMessage(chatId, msgId);
    ui.lastPromptId = undefined;
    setUI(userId, ui);
  } catch {
    // ignore
  }
}

async function ask(ctx, userId, text, extra) {
  const message = extra ? await ctx.reply(text, extra) : await ctx.reply(text);
  const ui = getUI(userId);
  ui.lastPromptId = message.message_id;
  setUI(userId, ui);
  return message;
}

async function spinnerStart(ctx, userId, textCycle = ['в процессе бро.', 'в процессе бро..', 'в процессе бро...']) {
  const ui = getUI(userId);

  if (ui.spinner?.timer) {
    try {
      if (ui.spinner.msgId) {
        await ctx.telegram.deleteMessage(ctx.chat.id, ui.spinner.msgId);
      }
    } catch {}
    clearInterval(ui.spinner.timer);
    ui.spinner = {};
  }

  const message = await ctx.reply(textCycle[0]);
  ui.spinner.msgId = message.message_id;

  let i = 1;
  ui.spinner.timer = setInterval(async () => {
    try {
      const next = textCycle[i % textCycle.length];
      await ctx.telegram.editMessageText(ctx.chat.id, ui.spinner.msgId, undefined, next);
      i += 1;
    } catch {}
  }, 500);

  setUI(userId, ui);
}

async function spinnerStop(ctx, userId) {
  const ui = getUI(userId);
  if (ui.spinner?.timer) {
    clearInterval(ui.spinner.timer);
  }
  if (ui.spinner?.msgId) {
    try {
      await ctx.telegram.deleteMessage(ctx.chat.id, ui.spinner.msgId);
    } catch {}
  }
  ui.spinner = {};
  setUI(userId, ui);
}

function editMenuKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('📍 Локация', 'edit:location')],
    [Markup.button.callback('🎧 Музыка', 'edit:music')],
    [Markup.button.callback('🍽️ Кухня', 'edit:cuisine')],
    [Markup.button.callback('🖼️ Живопись', 'edit:art')],
    [Markup.button.callback('✖️ Отмена', 'edit:cancel')]
  ]);
}

function cancelKeyboard() {
  return Markup.inlineKeyboard([[Markup.button.callback('↩️ Отмена', 'edit:back')]]);
}

async function showEditMenu(ctx, userId) {
  const text = 'Твой профиль уже готов. Хочешь изменить его? Выбери раздел:';
  const ui = getUI(userId);
  const menuIndex = [...ui.screens].reverse().findIndex((screen) => screen.type === 'menu');

  if (menuIndex !== -1) {
    const actualIndex = ui.screens.length - 1 - menuIndex;
    const existing = ui.screens[actualIndex];
    try {
      await ctx.telegram.editMessageText(ctx.chat.id, existing.messageId, undefined, text, {
        reply_markup: editMenuKeyboard().reply_markup
      });
      return existing.messageId;
    } catch {
      ui.screens.splice(actualIndex, 1);
      setUI(userId, ui);
    }
  }

  const message = await ctx.reply(text, editMenuKeyboard());
  pushScreen(userId, { type: 'menu', messageId: message.message_id });
  return message.message_id;
}

function firstFlat(arr, kind) {
  if (!Array.isArray(arr) || arr.length === 0) {
    return { main: null, add: null };
  }
  const item = arr[0] ?? {};
  if (kind === 'genre') {
    return { main: item.genre ?? null, add: item.additional ?? null };
  }
  if (kind === 'type') {
    return { main: item.type ?? null, add: item.additional ?? null };
  }
  return { main: null, add: null };
}

bot.start(async (ctx) => {
  const tgId = String(ctx.from.id);
  resetUI(tgId);

  const existing = await prisma.user.findUnique({ where: { id: tgId } });

  if (!existing) {
    await prisma.user.create({
      data: {
        id: tgId,
        step: 'dest',
        username: ctx.from.username ?? null,
        firstName: ctx.from.first_name ?? ctx.from.firstName ?? null,
        lastName: ctx.from.last_name ?? ctx.from.lastName ?? null
      }
    });
    await ctx.reply('Привет! Я помогу спланировать твои активности в поездке 👋');
    await ask(ctx, tgId, 'Куда ты собираешься ехать? (город/локация)');
    return;
  }

  await prisma.user.update({
    where: { id: tgId },
    data: {
      step: 'done',
      username: ctx.from.username ?? existing.username ?? null,
      firstName: ctx.from.first_name ?? ctx.from.firstName ?? existing.firstName ?? null,
      lastName: ctx.from.last_name ?? ctx.from.lastName ?? existing.lastName ?? null
    }
  });

  await showEditMenu(ctx, tgId);
});

bot.command('reset', async (ctx) => {
  const userRecord = await getOrCreateUser(ctx.from);
  await prisma.user.update({
    where: { id: userRecord.id },
    data: {
      step: 'dest',
      destination: null,
      country: null,
      city: null,
      dates: null,
      budget: null,
      music: null,
      cuisine: null,
      art: null,
      cinema: null,
      musicRaw: null,
      cuisineRaw: null,
      artRaw: null,
      cinemaRaw: null
    }
  });
  resetUI(userRecord.id);
  await ctx.reply('Сбросил прогресс. Давай заново.');
  await ask(ctx, userRecord.id, 'Куда ты собираешься ехать? (город/локация)');
});

bot.command('where', async (ctx) => {
  const userRecord = await getOrCreateUser(ctx.from);
  const user = await prisma.user.findUnique({ where: { id: userRecord.id } });
  await ctx.reply(`Текущий шаг: ${user?.step ?? 'dest'}`);
});

bot.command('profile', async (ctx) => {
  const userRecord = await getOrCreateUser(ctx.from);
  const user = await prisma.user.findUnique({ where: { id: userRecord.id } });
  if (!user) {
    await ctx.reply('Профиль ещё не создан.');
    return;
  }

  const musicArr = user.music ?? [];
  const cuisineArr = user.cuisine ?? [];
  const artArr = user.art ?? [];
  const cinemaArr = user.cinema ?? [];

  const { main: music, add: musicAdditional } = firstFlat(musicArr, 'genre');
  const { main: cuisine, add: cuisineAdditional } = firstFlat(cuisineArr, 'type');
  const { main: art, add: artAdditional } = firstFlat(artArr, 'genre');
  const { main: cinema, add: cinemaAdditional } = firstFlat(cinemaArr, 'type');

  const payload = {
    userId: user.id,
    destination: user.destination ?? null,
    country: user.country ?? null,
    city: user.city ?? null,
    dates: user.dates ?? null,
    budget: user.budget ?? null,
    music,
    musicAdditional,
    cuisine,
    cuisineAdditional,
    art,
    artAdditional,
    cinema,
    cinemaAdditional,
    musicArray: musicArr,
    cuisineArray: cuisineArr,
    artArray: artArr,
    cinemaArray: cinemaArr
  };

  await ctx.reply('Профиль:\n```json\n' + JSON.stringify(payload, null, 2) + '\n```', {
    parse_mode: 'Markdown'
  });
});

bot.command('profile_raw', async (ctx) => {
  const userRecord = await getOrCreateUser(ctx.from);
  const user = await prisma.user.findUnique({ where: { id: userRecord.id } });
  if (!user) {
    await ctx.reply('Пока нет данных.');
    return;
  }

  const rawPayload = {
    userId: user.id,
    destination: user.destination ?? null,
    country: user.country ?? null,
    city: user.city ?? null,
    dates: user.dates ?? null,
    musicRaw: user.musicRaw ?? null,
    cuisineRaw: user.cuisineRaw ?? null,
    artRaw: user.artRaw ?? null,
    cinemaRaw: user.cinemaRaw ?? null,
    budget: user.budget ?? null
  };

  await ctx.reply('Raw данные:\n```json\n' + JSON.stringify(rawPayload, null, 2) + '\n```', {
    parse_mode: 'Markdown'
  });
});

bot.on('callback_query', async (ctx) => {
  const userRecord = await getOrCreateUser(ctx.from);
  const tgId = userRecord.id;
  const data = ctx.callbackQuery?.data || '';

  try {
    await ctx.answerCbQuery();
  } catch {}

  if (data === 'edit:location') {
    await prisma.user.update({ where: { id: tgId }, data: { step: 'edit_location' } });
    const message = await ctx.reply('Введи новую локацию (город или город, страна):', cancelKeyboard());
    pushScreen(tgId, { type: 'edit_location', messageId: message.message_id });
    return;
  }

  if (data === 'edit:music') {
    await prisma.user.update({ where: { id: tgId }, data: { step: 'edit_music' } });
    const message = await ctx.reply('Обнови музыкальные предпочтения (жанры/артисты/плейлисты):', cancelKeyboard());
    pushScreen(tgId, { type: 'edit_music', messageId: message.message_id });
    return;
  }

  if (data === 'edit:cuisine') {
    await prisma.user.update({ where: { id: tgId }, data: { step: 'edit_cuisine' } });
    const message = await ctx.reply('Обнови предпочтения в еде (кухни/блюда/форматы):', cancelKeyboard());
    pushScreen(tgId, { type: 'edit_cuisine', messageId: message.message_id });
    return;
  }

  if (data === 'edit:art') {
    await prisma.user.update({ where: { id: tgId }, data: { step: 'edit_art' } });
    const message = await ctx.reply('Обнови предпочтения в искусстве (направления/авторы):', cancelKeyboard());
    pushScreen(tgId, { type: 'edit_art', messageId: message.message_id });
    return;
  }

  if (data === 'edit:cancel') {
    const scr = popScreen(tgId);
    if (scr?.messageId) {
      try {
        await ctx.telegram.deleteMessage(ctx.chat.id, scr.messageId);
      } catch {}
    }
    await prisma.user.update({ where: { id: tgId }, data: { step: 'done' } });
    return;
  }

  if (data === 'edit:back') {
    const scr = popScreen(tgId);
    if (scr?.messageId) {
      try {
        await ctx.telegram.deleteMessage(ctx.chat.id, scr.messageId);
      } catch {}
    }
    await prisma.user.update({ where: { id: tgId }, data: { step: 'done' } });
    await showEditMenu(ctx, tgId);
    return;
  }
});

bot.on('text', async (ctx) => {
  const userRecord = await getOrCreateUser(ctx.from);
  const user = await prisma.user.findUnique({ where: { id: userRecord.id } });
  const step = user?.step ?? 'dest';
  const text = (ctx.message?.text || '').trim();

  if (text.startsWith('/')) {
    return;
  }

  if (step === 'edit_location') {
    const prev = popScreen(userRecord.id);
    if (prev?.messageId) {
      try {
        await ctx.telegram.deleteMessage(ctx.chat.id, prev.messageId);
      } catch {}
    }

    await spinnerStart(ctx, userRecord.id);
    let loc;
    try {
      loc = await normalizeLocation(text);
    } catch (error) {
      console.error('normalizeLocation error', error);
      loc = {
        city: null,
        country: null,
        normalized: null,
        needsCity: false,
        needsCountry: false
      };
    } finally {
      await spinnerStop(ctx, userRecord.id);
    }

    if (loc.needsCity && loc.country) {
      await prisma.user.update({
        where: { id: userRecord.id },
        data: { country: loc.country, city: null, destination: null, step: 'edit_location' }
      });
      const message = await ctx.reply(`Ок, страна "${loc.country}". А какой город?`, cancelKeyboard());
      pushScreen(userRecord.id, { type: 'edit_location', messageId: message.message_id });
      return;
    }

    if (loc.needsCountry && loc.city) {
      await prisma.user.update({
        where: { id: userRecord.id },
        data: { city: loc.city, country: null, destination: null, step: 'edit_location' }
      });
      const message = await ctx.reply(`Ок, город "${loc.city}". Уточни страну, пожалуйста.`, cancelKeyboard());
      pushScreen(userRecord.id, { type: 'edit_location', messageId: message.message_id });
      return;
    }

    const city = loc.city || null;
    const country = loc.country || null;
    const destination = city && country ? `${city}, ${country}` : loc.normalized || text;

    await prisma.user.update({
      where: { id: userRecord.id },
      data: { city, country, destination, step: 'done' }
    });

    await ctx.reply(`Локация обновлена: ${destination}.`);
    await showEditMenu(ctx, userRecord.id);
    return;
  }

  if (step === 'edit_music') {
    const prev = popScreen(userRecord.id);
    if (prev?.messageId) {
      try {
        await ctx.telegram.deleteMessage(ctx.chat.id, prev.messageId);
      } catch {}
    }

    await spinnerStart(ctx, userRecord.id);
    try {
      const music = await normalizeMusic(text);
      await prisma.user.update({
        where: { id: userRecord.id },
        data: { musicRaw: text, music, step: 'done' }
      });
    } catch (error) {
      console.error('normalizeMusic error', error);
      await prisma.user.update({
        where: { id: userRecord.id },
        data: { musicRaw: text, step: 'done' }
      });
    } finally {
      await spinnerStop(ctx, userRecord.id);
    }

    await ctx.reply('Музыкальные предпочтения обновлены.');
    await showEditMenu(ctx, userRecord.id);
    return;
  }

  if (step === 'edit_cuisine') {
    const prev = popScreen(userRecord.id);
    if (prev?.messageId) {
      try {
        await ctx.telegram.deleteMessage(ctx.chat.id, prev.messageId);
      } catch {}
    }

    await spinnerStart(ctx, userRecord.id);
    try {
      const cuisine = await normalizeCuisine(text);
      await prisma.user.update({
        where: { id: userRecord.id },
        data: { cuisineRaw: text, cuisine, step: 'done' }
      });
    } catch (error) {
      console.error('normalizeCuisine error', error);
      await prisma.user.update({
        where: { id: userRecord.id },
        data: { cuisineRaw: text, step: 'done' }
      });
    } finally {
      await spinnerStop(ctx, userRecord.id);
    }

    await ctx.reply('Предпочтения в еде обновлены.');
    await showEditMenu(ctx, userRecord.id);
    return;
  }

  if (step === 'edit_art') {
    const prev = popScreen(userRecord.id);
    if (prev?.messageId) {
      try {
        await ctx.telegram.deleteMessage(ctx.chat.id, prev.messageId);
      } catch {}
    }

    await spinnerStart(ctx, userRecord.id);
    try {
      const art = await normalizeArt(text);
      await prisma.user.update({
        where: { id: userRecord.id },
        data: { artRaw: text, art, step: 'done' }
      });
    } catch (error) {
      console.error('normalizeArt error', error);
      await prisma.user.update({
        where: { id: userRecord.id },
        data: { artRaw: text, step: 'done' }
      });
    } finally {
      await spinnerStop(ctx, userRecord.id);
    }

    await ctx.reply('Предпочтения в живописи/искусстве обновлены.');
    await showEditMenu(ctx, userRecord.id);
    return;
  }

  if (step === 'dest') {
    await deletePrevPrompt(ctx, userRecord.id);
    await spinnerStart(ctx, userRecord.id);
    let loc;
    try {
      loc = await normalizeLocation(text);
    } catch (error) {
      console.error('normalizeLocation error', error);
      loc = {
        city: null,
        country: null,
        normalized: null,
        needsCity: false,
        needsCountry: false
      };
    } finally {
      await spinnerStop(ctx, userRecord.id);
    }

    if (loc.needsCity && loc.country) {
      await prisma.user.update({
        where: { id: userRecord.id },
        data: {
          country: loc.country,
          city: null,
          destination: null,
          step: 'dest_city'
        }
      });
      await ask(ctx, userRecord.id, `Ок, страна "${loc.country}". А какой город?`);
      return;
    }

    if (loc.needsCountry && loc.city) {
      await prisma.user.update({
        where: { id: userRecord.id },
        data: {
          city: loc.city,
          country: null,
          destination: null,
          step: 'dest_country'
        }
      });
      await ask(ctx, userRecord.id, `Ок, город "${loc.city}". Уточни страну, пожалуйста.`);
      return;
    }

    const city = loc.city || null;
    const country = loc.country || null;
    const destination = city && country ? `${city}, ${country}` : loc.normalized || text;

    await prisma.user.update({
      where: { id: userRecord.id },
      data: { city, country, destination, step: 'dates' }
    });

    const note = loc.normalized ? `Принял: ${loc.normalized}.` : `Принял: ${destination}.`;
    await ask(
      ctx,
      userRecord.id,
      `${note}\nВ какие даты? Можно свободно: "12-18 октября 2025" или "2025-10-12 — 2025-10-18"`
    );
    return;
  }

  if (step === 'dest_city') {
    await deletePrevPrompt(ctx, userRecord.id);
    await spinnerStart(ctx, userRecord.id);
    let guess;
    try {
      guess = await normalizeLocation(`${text}, ${user.country ?? ''}`);
    } catch (error) {
      console.error('normalizeLocation (dest_city) error', error);
      guess = {
        city: null,
        country: user.country ?? null,
        normalized: null
      };
    } finally {
      await spinnerStop(ctx, userRecord.id);
    }

    const city = guess.city || text;
    const country = user.country || guess.country || null;
    const destination = city && country ? `${city}, ${country}` : guess.normalized || text;

    await prisma.user.update({
      where: { id: userRecord.id },
      data: { city, country, destination, step: 'dates' }
    });

    await ask(ctx, userRecord.id, `Принял: ${destination}.\nТеперь даты?`);
    return;
  }

  if (step === 'dest_country') {
    await deletePrevPrompt(ctx, userRecord.id);
    await spinnerStart(ctx, userRecord.id);
    let guess;
    try {
      guess = await normalizeLocation(`${user.city ?? ''}, ${text}`);
    } catch (error) {
      console.error('normalizeLocation (dest_country) error', error);
      guess = {
        city: user.city ?? null,
        country: null,
        normalized: null
      };
    } finally {
      await spinnerStop(ctx, userRecord.id);
    }

    const city = user.city || guess.city || null;
    const country = guess.country || text;
    const destination = city && country ? `${city}, ${country}` : guess.normalized || text;

    await prisma.user.update({
      where: { id: userRecord.id },
      data: { city, country, destination, step: 'dates' }
    });

    await ask(ctx, userRecord.id, `Принял: ${destination}.\nТеперь даты?`);
    return;
  }

  if (step === 'dates') {
    await deletePrevPrompt(ctx, userRecord.id);
    const range = parseDateRangeFlexible(text);
    if (!range) {
      await ask(
        ctx,
        userRecord.id,
        'Не понял даты. Примеры: 2025-10-12 — 2025-10-18, 12-18 октября 2025, 12.10-18.10.2025'
      );
      return;
    }
    await prisma.user.update({
      where: { id: userRecord.id },
      data: { dates: range, step: 'tastes_music' }
    });
    await ask(ctx, userRecord.id, 'Расскажи про музыку (жанры, сцены, артисты, плейлисты).');
    return;
  }

  if (step === 'tastes_music') {
    await deletePrevPrompt(ctx, userRecord.id);
    await spinnerStart(ctx, userRecord.id);
    try {
      const music = await normalizeMusic(text);
      await prisma.user.update({
        where: { id: userRecord.id },
        data: {
          musicRaw: text,
          music,
          step: 'tastes_cuisine'
        }
      });
    } catch (error) {
      console.error('normalizeMusic error', error);
      await prisma.user.update({
        where: { id: userRecord.id },
        data: {
          musicRaw: text,
          step: 'tastes_cuisine'
        }
      });
    } finally {
      await spinnerStop(ctx, userRecord.id);
    }

    await ask(
      ctx,
      userRecord.id,
      'Теперь про еду: кухни, блюда, форматы (casual, fine dining), любимые места.'
    );
    return;
  }

  if (step === 'tastes_cuisine') {
    await deletePrevPrompt(ctx, userRecord.id);
    await spinnerStart(ctx, userRecord.id);
    try {
      const cuisine = await normalizeCuisine(text);
      await prisma.user.update({
        where: { id: userRecord.id },
        data: {
          cuisineRaw: text,
          cuisine,
          step: 'tastes_art'
        }
      });
    } catch (error) {
      console.error('normalizeCuisine error', error);
      await prisma.user.update({
        where: { id: userRecord.id },
        data: {
          cuisineRaw: text,
          step: 'tastes_art'
        }
      });
    } finally {
      await spinnerStop(ctx, userRecord.id);
    }

    await ask(ctx, userRecord.id, 'А что по искусству? Направления, художники, музеи, выставки.');
    return;
  }

  if (step === 'tastes_art') {
    await deletePrevPrompt(ctx, userRecord.id);
    await spinnerStart(ctx, userRecord.id);
    try {
      const art = await normalizeArt(text);
      await prisma.user.update({
        where: { id: userRecord.id },
        data: {
          artRaw: text,
          art,
          step: 'tastes_cinema'
        }
      });
    } catch (error) {
      console.error('normalizeArt error', error);
      await prisma.user.update({
        where: { id: userRecord.id },
        data: {
          artRaw: text,
          step: 'tastes_cinema'
        }
      });
    } finally {
      await spinnerStop(ctx, userRecord.id);
    }

    await ask(
      ctx,
      userRecord.id,
      'И про кино: жанры, режиссёры, фестивали, форматы (артхаус и т.п.).'
    );
    return;
  }

  if (step === 'tastes_cinema') {
    await deletePrevPrompt(ctx, userRecord.id);
    await spinnerStart(ctx, userRecord.id);
    try {
      const cinema = await normalizeCinema(text);
      await prisma.user.update({
        where: { id: userRecord.id },
        data: {
          cinemaRaw: text,
          cinema,
          step: 'budget'
        }
      });
    } catch (error) {
      console.error('normalizeCinema error', error);
      await prisma.user.update({
        where: { id: userRecord.id },
        data: {
          cinemaRaw: text,
          step: 'budget'
        }
      });
    } finally {
      await spinnerStop(ctx, userRecord.id);
    }

    await ask(ctx, userRecord.id, 'Какой бюджет на мероприятия/рестораны (в € или диапазон)?');
    return;
  }

  if (step === 'budget') {
    await deletePrevPrompt(ctx, userRecord.id);
    await prisma.user.update({
      where: { id: userRecord.id },
      data: {
        budget: text,
        step: 'done'
      }
    });
    await ctx.reply('Готово! Профиль сохранён. Набери /profile, чтобы посмотреть.');
    return;
  }

  if (step === 'done') {
    await spinnerStart(ctx, userRecord.id);
    try {
      const answer = await friendlyReply(text);
      await ctx.reply(answer);
    } catch (error) {
      console.error('LLM error:', error);
      await ctx.reply('Сейчас не смог ответить. Попробуй ещё раз.');
    } finally {
      await spinnerStop(ctx, userRecord.id);
    }
    return;
  }

  await spinnerStart(ctx, userRecord.id);
  try {
    const answer = await friendlyReply(text);
    await ctx.reply(answer);
  } catch (error) {
    console.error('LLM error:', error);
    await ctx.reply('Принял.');
  } finally {
    await spinnerStop(ctx, userRecord.id);
  }
});

function buildProfileResponse(user) {
  const musicArr = user.music ?? [];
  const cuisineArr = user.cuisine ?? [];
  const artArr = user.art ?? [];
  const cinemaArr = user.cinema ?? [];

  const { main: music, add: musicAdditional } = firstFlat(musicArr, 'genre');
  const { main: cuisine, add: cuisineAdditional } = firstFlat(cuisineArr, 'type');
  const { main: art, add: artAdditional } = firstFlat(artArr, 'genre');
  const { main: cinema, add: cinemaAdditional } = firstFlat(cinemaArr, 'type');

  return {
    userId: user.id,
    destination: user.destination ?? null,
    country: user.country ?? null,
    city: user.city ?? null,
    dates: user.dates ?? null,
    budget: user.budget ?? null,
    music,
    musicAdditional,
    cuisine,
    cuisineAdditional,
    art,
    artAdditional,
    cinema,
    cinemaAdditional,
    musicArray: musicArr,
    cuisineArray: cuisineArr,
    artArray: artArr,
    cinemaArray: cinemaArr
  };
}

app.get('/api/users', async (req, res) => {
  const offset = Math.max(parseInt(req.query.offset || '0', 10), 0);
  const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 100);
  const [items, total] = await Promise.all([
    prisma.user.findMany({
      skip: offset,
      take: limit,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        step: true,
        destination: true,
        country: true,
        city: true,
        dates: true,
        updatedAt: true
      }
    }),
    prisma.user.count()
  ]);
  res.json({ total, offset, limit, items });
});

app.get('/api/users/:id', async (req, res) => {
  const id = String(req.params.id);
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    res.status(404).json({ error: 'not found' });
    return;
  }
  res.json(buildProfileResponse(user));
});

app.get('/api/users/:id/raw', async (req, res) => {
  const id = String(req.params.id);
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    res.status(404).json({ error: 'not found' });
    return;
  }
  res.json({
    userId: user.id,
    step: user.step,
    destination: user.destination ?? null,
    country: user.country ?? null,
    city: user.city ?? null,
    dates: user.dates ?? null,
    musicRaw: user.musicRaw ?? null,
    cuisineRaw: user.cuisineRaw ?? null,
    artRaw: user.artRaw ?? null,
    cinemaRaw: user.cinemaRaw ?? null,
    budget: user.budget ?? null
  });
});

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/healthz', (_req, res) => {
  res.json({
    ok: true,
    mode: process.env.WEBHOOK_URL ? 'webhook' : 'polling',
    webhookSecret: Boolean(process.env.TG_WEBHOOK_SECRET)
  });
});

app.get('/ready', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'db_not_ready' });
  }
});

app.get('/api/diag/webhook', async (_req, res) => {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      res.status(400).json({ error: 'no_token' });
      return;
    }
    const info = await getWebhookInfo(botToken);
    res.json({ ok: true, info });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error) });
  }
});

const port = process.env.PORT || 8080;
app.listen(port, async () => {
  console.log(`HTTP on :${port}`);
  await ensureWebhook(bot, app);
});

process.once('SIGINT', () => {
  try {
    bot.stop('SIGINT');
  } catch {}
  process.exit(0);
});

process.once('SIGTERM', () => {
  try {
    bot.stop('SIGTERM');
  } catch {}
  process.exit(0);
});
