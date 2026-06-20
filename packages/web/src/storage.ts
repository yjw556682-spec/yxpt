import type { BotKeyRecord } from './types';

const KEY = 'yxpt_bot_key';

export function loadBotKey(): BotKeyRecord | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BotKeyRecord>;
    if (typeof parsed.botId !== 'number' || typeof parsed.botKey !== 'string') return null;
    return {
      botId: parsed.botId,
      botKey: parsed.botKey,
      displayName: parsed.displayName ?? '',
      mode: parsed.mode ?? 'grid-duel',
    };
  } catch {
    return null;
  }
}

export function saveBotKey(rec: BotKeyRecord): void {
  localStorage.setItem(KEY, JSON.stringify(rec));
}

export function clearBotKey(): void {
  localStorage.removeItem(KEY);
}

export const DEFAULT_BOT_CODE = `// onTick is called every frame with your bot's view (me) and the world.
// Return an action like { action: "fire" }, { action: "move" }, or { action: "skip" }.
// World view (me): { position:[x,y], direction:0..3, canFire, enemy, star, tick }
// Actions:
//   { action: "move" }                     step forward
//   { action: "turn", args: ["left"|"right"] }
//   { action: "fire" }                     shoots if canFire
//   { action: "skip" }                     do nothing
function onTick(me, world) {
  if (me.canFire) return { action: "fire" };
  if (me.enemy) {
    return { action: "move" };
  }
  return { action: "skip" };
}
`;