import { createHash } from 'node:crypto';
import type { Cmd, GameMode, MatchResult, Replay, TickEvent, WorldView } from '@yxpt/shared-types';
import { BotSandbox } from './sandbox.js';

export async function runMatch(
  mode: GameMode,
  codes: [string, string],
  seed: number,
): Promise<Replay> {
  const codeHashes = codes.map(c =>
    createHash('sha256').update(c).digest('hex'),
  );

  const sandboxes: BotSandbox[] = [];
  try {
    sandboxes.push(await BotSandbox.create(codes[0], seed));
    sandboxes.push(await BotSandbox.create(codes[1], seed));
  } catch {
    // Failed to create a sandbox (e.g., onTick missing) — player 0 loses if sandbox 0 fails, etc.
    for (const s of sandboxes) s.dispose();
    const failed = sandboxes.length; // 0 or 1
    return {
      meta: { modeId: mode.id, seed, players: ['p0', 'p1'], codeHashes },
      events: [],
      result: { done: true, winner: failed === 0 ? 1 : 0, reason: 'error' },
    };
  }

  let state = mode.init(seed, ['p0', 'p1']);
  const events: TickEvent[] = [];

  for (let tick = 0; tick < mode.maxTicks; tick++) {
    // Get commands from each player's bot
    const cmds: (Cmd | null)[] = [];

    for (let i = 0; i < mode.maxPlayers; i++) {
      const view = mode.view(state, i);
      try {
        const cmd = await sandboxes[i].tick(view, state as unknown as WorldView);
        cmds.push(cmd);
      } catch (err: unknown) {
        const kind = (err as { kind?: string }).kind;
        const reason = kind === 'runtime' ? 'runtime' : 'error';
        const result: MatchResult = { done: true, winner: 1 - i, reason };
        for (const s of sandboxes) s.dispose();
        return {
          meta: { modeId: mode.id, seed, players: ['p0', 'p1'], codeHashes },
          events,
          result,
        };
      }
    }

    // Advance the game state
    const stepResult = mode.step(state, cmds);
    state = stepResult.state;
    events.push(...stepResult.events);

    // Check if match ended
    const matchResult = mode.result(state);
    if (matchResult.done) {
      for (const s of sandboxes) s.dispose();
      return {
        meta: { modeId: mode.id, seed, players: ['p0', 'p1'], codeHashes },
        events,
        result: matchResult,
      };
    }
  }

  // Max ticks reached — get final result
  for (const s of sandboxes) s.dispose();
  const finalResult = mode.result(state);
  return {
    meta: { modeId: mode.id, seed, players: ['p0', 'p1'], codeHashes },
    events,
    result: finalResult.done ? finalResult : { done: true, winner: null, reason: 'draw' },
  };
}
