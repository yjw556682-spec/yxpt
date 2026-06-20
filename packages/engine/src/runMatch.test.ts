import { describe, it, expect } from 'vitest';
import { runMatch } from './runMatch.js';
import { gridDuel } from './modes/gridDuel.js';

const BOT_DO_NOTHING = 'function onTick(me, world) { return null; }';
const BOT_INFINITE_LOOP = 'function onTick(me, world) { while(true){} }';
const BOT_THROW = 'function onTick(me, world) { throw new Error("bot kaboom"); }';
const BOT_TURN_ONLY = 'function onTick(me, world) { return { action: "turn", args: ["left"] }; }';
const BOT_AGGRESSIVE = `
function onTick(me, world) {
  if (me.canFire) return { action: "fire" };
  return { action: "move" };
}
`;

describe('runMatch determinism', () => {
  it('produces identical replay for same seed', async () => {
    const a = await runMatch(gridDuel, [BOT_DO_NOTHING, BOT_DO_NOTHING], 42);
    const b = await runMatch(gridDuel, [BOT_DO_NOTHING, BOT_DO_NOTHING], 42);
    expect(a.events).toEqual(b.events);
    expect(a.result).toEqual(b.result);
    expect(a.meta.seed).toBe(b.meta.seed);
  });

  it('different seeds produce different event sequences when bots interact', async () => {
    // Bots that move so star position matters
    const MOVE_BOT = 'function onTick(m,w){ return {action:"move"}; }';
    const a = await runMatch(gridDuel, [MOVE_BOT, MOVE_BOT], 42);
    const b = await runMatch(gridDuel, [MOVE_BOT, MOVE_BOT], 99);
    // At least one event or result should differ between seeds
    const sameEvents = JSON.stringify(a.events) === JSON.stringify(b.events);
    const sameResult = JSON.stringify(a.result) === JSON.stringify(b.result);
    expect(sameEvents && sameResult).toBe(false);
  });
});

describe('runMatch sandbox failures', () => {
  it('infinite loop bot loses with reason "runtime"', async () => {
    const replay = await runMatch(gridDuel, [BOT_INFINITE_LOOP, BOT_DO_NOTHING], 42);
    expect(replay.result.done).toBe(true);
    expect(replay.result.winner).toBe(1); // player 1 wins (the do-nothing bot)
    expect(replay.result.reason).toBe('runtime');
  });

  it('throwing bot loses with reason "error"', async () => {
    const replay = await runMatch(gridDuel, [BOT_DO_NOTHING, BOT_THROW], 42);
    expect(replay.result.done).toBe(true);
    expect(replay.result.winner).toBe(0); // player 0 wins
    expect(replay.result.reason).toBe('error');
  });
});

describe('runMatch bot behavior', () => {
  it('aggressive bot does not lose to passive turn-only bot', async () => {
    const replay = await runMatch(gridDuel, [BOT_AGGRESSIVE, BOT_TURN_ONLY], 42);
    expect(replay.result.done).toBe(true);
    // aggressive bot (player 0) wins or draws — never loses
    if (replay.result.winner !== null) {
      expect(replay.result.winner).toBe(0);
    }
  });
});
