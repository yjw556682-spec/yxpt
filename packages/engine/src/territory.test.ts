import { describe, it, expect } from 'vitest';
import { runMatch } from './runMatch.js';
import { territory } from './modes/territory.js';

const EXPAND_BOT = 'function onTick(me, world) { return { action: "expand" }; }';
const TURN_BOT = 'function onTick(me, world) { return { action: "turn", args: ["right"] }; }';
const INFINITE_LOOP_BOT = 'function onTick(me, world) { while(true){} }';

describe('territory mode', () => {
  // runMatch is completely mode-agnostic — it calls mode.init/view/step/result generically
  // with zero knowledge of territory's internals. These tests prove pluggability.

  it('determinism: same seed produces identical replays', async () => {
    const a = await runMatch(territory, [EXPAND_BOT, TURN_BOT], 42);
    const b = await runMatch(territory, [EXPAND_BOT, TURN_BOT], 42);
    expect(a.events).toEqual(b.events);
    expect(a.result).toEqual(b.result);
    expect(a.meta.seed).toBe(b.meta.seed);
  });

  it('expandBot wins or draws against turnBot', async () => {
    const replay = await runMatch(territory, [EXPAND_BOT, TURN_BOT], 42);
    expect(replay.result.done).toBe(true);
    // expandBot captures territory while turnBot just spins — should never lose
    if (replay.result.winner !== null) {
      expect(replay.result.winner).toBe(0);
    }
  });

  it('infinite loop bot loses with reason "runtime"', async () => {
    const replay = await runMatch(territory, [INFINITE_LOOP_BOT, EXPAND_BOT], 42);
    expect(replay.result.done).toBe(true);
    expect(replay.result.winner).toBe(1);
    expect(replay.result.reason).toBe('runtime');
  });

  it('runMatch works with territory using same import pattern as grid-duel tests', async () => {
    // Same import: import { runMatch } from './runMatch.js'; import { territory } from './modes/territory.js';
    const replay = await runMatch(territory, [EXPAND_BOT, TURN_BOT], 99);
    expect(replay.meta.modeId).toBe('territory');
    expect(replay.events.length).toBeGreaterThan(0);
  });
});
