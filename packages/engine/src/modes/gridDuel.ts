import type { Cmd, GameMode, MatchResult, TickEvent, WorldView } from '@yxpt/shared-types';

const GRID = 11;
const MAX_TICKS = 200;
const DIR: [number, number][] = [[0, -1], [1, 0], [0, 1], [-1, 0]];

interface Tank {
  x: number;
  y: number;
  dir: number;
  alive: boolean;
  score: number;
  bullet: { x: number; y: number; dir: number } | null;
}

interface GridDuelState {
  players: [Tank, Tank];
  star: { x: number; y: number } | null;
  tick: number;
  rngState: number;
}

// mulberry32 integer state — no float accumulation
function nextRng(state: number): [number, number] {
  state |= 0;
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  t = ((t ^ (t >>> 14)) >>> 0);
  return [t, state];
}

function spawnStar(state: GridDuelState): { x: number; y: number } {
  const occupied = new Set(state.players.map(p => `${p.x},${p.y}`));
  const free: [number, number][] = [];
  for (let x = 0; x < GRID; x++) {
    for (let y = 0; y < GRID; y++) {
      if (!occupied.has(`${x},${y}`)) {
        free.push([x, y]);
      }
    }
  }
  if (free.length === 0) return { x: -1, y: -1 };
  const [r, newState] = nextRng(state.rngState);
  state.rngState = newState;
  return { x: free[r % free.length][0], y: free[r % free.length][1] };
}

export const gridDuel: GameMode<GridDuelState> = {
  id: 'grid-duel',
  name: 'Grid Duel',
  maxPlayers: 2,
  maxTicks: MAX_TICKS,

  init(seed: number, _playerIds: string[]): GridDuelState {
    const state: GridDuelState = {
      players: [
        { x: 0, y: 0, dir: 1, alive: true, score: 0, bullet: null },
        { x: 10, y: 10, dir: 3, alive: true, score: 0, bullet: null },
      ],
      star: null,
      tick: 0,
      rngState: seed | 0,
    };
    state.star = spawnStar(state);
    return state;
  },

  view(state: GridDuelState, playerIndex: number): WorldView {
    const p = state.players[playerIndex];
    const enemy = state.players[1 - playerIndex];
    return {
      position: [p.x, p.y] as [number, number],
      direction: p.dir,
      canFire: p.bullet === null && p.alive,
      enemy: enemy.alive ? { position: [enemy.x, enemy.y] as [number, number] } : null,
      star: state.star ? ([state.star.x, state.star.y] as [number, number]) : null,
      tick: state.tick,
    };
  },

  step(state: GridDuelState, cmds: (Cmd | null)[]): { state: GridDuelState; events: TickEvent[] } {
    const events: TickEvent[] = [];
    // Shallow-clone players, deep-clone bullet
    const newPlayers: [Tank, Tank] = [
      cloneTank(state.players[0]),
      cloneTank(state.players[1]),
    ];

    // 1. Process commands for alive players
    for (let i = 0; i < 2; i++) {
      const p = newPlayers[i];
      if (!p.alive) continue;
      const cmd = cmds[i];
      if (!cmd) continue;

      switch (cmd.action) {
        case 'move': {
          const [dx, dy] = DIR[p.dir];
          const nx = p.x + dx;
          const ny = p.y + dy;
          if (nx >= 0 && nx < GRID && ny >= 0 && ny < GRID) {
            p.x = nx;
            p.y = ny;
            events.push({ tick: state.tick, type: 'move', player: i, position: [nx, ny] });
          }
          break;
        }
        case 'turn': {
          const dir = (cmd.args?.[0] as string) || '';
          if (dir === 'left') {
            p.dir = ((p.dir - 1) + 4) % 4;
            events.push({ tick: state.tick, type: 'turn', player: i, direction: p.dir });
          } else if (dir === 'right') {
            p.dir = (p.dir + 1) % 4;
            events.push({ tick: state.tick, type: 'turn', player: i, direction: p.dir });
          }
          break;
        }
        case 'fire': {
          if (p.bullet === null) {
            const [dx, dy] = DIR[p.dir];
            p.bullet = { x: p.x + dx, y: p.y + dy, dir: p.dir };
            events.push({ tick: state.tick, type: 'fire', player: i });
          }
          break;
        }
      }
    }

    // 2. Advance bullets and check hits
    for (let i = 0; i < 2; i++) {
      const b = newPlayers[i].bullet;
      if (!b) continue;
      const [dx, dy] = DIR[b.dir];
      b.x += dx;
      b.y += dy;

      // Out of bounds → bullet disappears
      if (b.x < 0 || b.x >= GRID || b.y < 0 || b.y >= GRID) {
        newPlayers[i].bullet = null;
        events.push({ tick: state.tick, type: 'bullet_miss', player: i });
        continue;
      }

      // Check hit on enemy
      const target = newPlayers[1 - i];
      if (target.alive && b.x === target.x && b.y === target.y) {
        target.alive = false;
        newPlayers[i].bullet = null;
        events.push({ tick: state.tick, type: 'destroyed', player: 1 - i, by: i });
      }
    }

    // 3. Check star collection
    if (newPlayers[0].alive || newPlayers[1].alive) {
      for (let i = 0; i < 2; i++) {
        const p = newPlayers[i];
        if (!p.alive) continue;
        const s = state.star;
        if (s && p.x === s.x && p.y === s.y) {
          p.score++;
          events.push({ tick: state.tick, type: 'collect', player: i });
        }
      }
    }

    // Spawn new star (always after collection check)
    const newState: GridDuelState = {
      players: newPlayers,
      star: state.star,
      tick: state.tick + 1,
      rngState: state.rngState,
    };

    // If star was collected (or doesn't exist), spawn a new one
    const starCollected = state.star !== null && (
      (newPlayers[0].alive && newPlayers[0].x === state.star.x && newPlayers[0].y === state.star.y) ||
      (newPlayers[1].alive && newPlayers[1].x === state.star.x && newPlayers[1].y === state.star.y)
    );
    if (starCollected || state.star === null) {
      newState.star = spawnStar(newState);
    } else {
      newState.star = state.star;
    }

    return { state: newState, events };
  },

  result(state: GridDuelState): MatchResult {
    const alive = state.players.filter(p => p.alive);
    if (alive.length === 0) {
      return { done: true, winner: null, reason: 'draw' };
    }
    if (alive.length === 1) {
      return { done: true, winner: state.players.indexOf(alive[0]), reason: 'destroyed' };
    }
    if (state.tick >= MAX_TICKS) {
      const s0 = state.players[0].score;
      const s1 = state.players[1].score;
      if (s0 > s1) return { done: true, winner: 0, reason: 'score' };
      if (s1 > s0) return { done: true, winner: 1, reason: 'score' };
      return { done: true, winner: null, reason: 'draw' };
    }
    return { done: false, winner: null, reason: 'draw' };
  },
};

function cloneTank(t: Tank): Tank {
  return {
    x: t.x,
    y: t.y,
    dir: t.dir,
    alive: t.alive,
    score: t.score,
    bullet: t.bullet ? { x: t.bullet.x, y: t.bullet.y, dir: t.bullet.dir } : null,
  };
}
