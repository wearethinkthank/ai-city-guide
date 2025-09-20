// UI-состояние: id последнего вопроса + стек "экранов" (для возврата по Отмена)
const uiMemory = new Map(); // userId -> { lastPromptId?: number, screens?: Array<{type:string, messageId:number}>, spinner?: { msgId?: number, timer?: NodeJS.Timer } }

export function getUI(userId) {
  if (!uiMemory.has(userId)) {
    uiMemory.set(userId, { lastPromptId: undefined, screens: [], spinner: {} });
  }
  const ui = uiMemory.get(userId);
  if (!ui.screens) ui.screens = [];
  if (!ui.spinner) ui.spinner = {};
  if (typeof ui.lastPromptId === 'undefined') ui.lastPromptId = undefined;
  return ui;
}

export function setUI(userId, ui) {
  if (!ui.screens) ui.screens = [];
  if (!ui.spinner) ui.spinner = {};
  if (typeof ui.lastPromptId === 'undefined') ui.lastPromptId = undefined;
  uiMemory.set(userId, ui);
}

export function resetUI(userId) {
  const ui = getUI(userId);
  if (ui.spinner?.timer) clearInterval(ui.spinner.timer);
  uiMemory.set(userId, { lastPromptId: undefined, screens: [], spinner: {} });
}

export function pushScreen(userId, screen) {
  const ui = getUI(userId);
  ui.screens.push(screen);
  setUI(userId, ui);
}

export function popScreen(userId) {
  const ui = getUI(userId);
  const scr = ui.screens.pop();
  setUI(userId, ui);
  return scr;
}
