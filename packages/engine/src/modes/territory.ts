import type { Cmd, GameMode, MatchResult, TickEvent, WorldView } from '@yxpt/shared-types';

const GRID = 9;
const MAX_TICKS = 150;
// east, south, west, north
const DIR: [number, number][] = [[1, 0], [0, 1], [-1, 0], [0, -1]];

interface TerritoryState {
  grid: number[][]; // grid[y][x] = -1 (neutral), 0 (player 0), 1 (player 1)
  cursors: [
    { x: number; y: number; dir: number },
    { x: number; y: number; dir: number },
  ];
  tick: number;
}

function countOwned(grid: number[][], player: number): number {
  let count = 0;
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (grid[y][x] === player) count++;
    }
  }
  return count;
}

export const territory: GameMode<TerritoryState> = {
  id: 'territory',
  name: 'Territory',
  maxPlayers: 2,
  maxTicks: MAX_TICKS,

  init(_seed: number, _playerIds: string[]): TerritoryState {
    const grid: number[][] = [];
    for (let y = 0; y < GRID; y++) {
      const row: number[] = [];
      for (let x = 0; x < GRID; x++) row.push(-1);
      grid.push(row);
    }

    // Player 0 home: top-left 3x3 (x:0-2, y:0-2)
    for (let y = 0; y < 3; y++)
      for (let x = 0; x < 3; x++)
        grid[y][x] = 0;

    // Player 1 home: bottom-right 3x3 (x:6-8, y:6-8)
    for (let y = 6; y < 9; y++)
      for (let x = 6; x < 9; x++)
        grid[y][x] = 1;

    return {
      grid,
      cursors: [
        { x: 1, y: 1, dir: 0 }, // center of home block, facing east
        { x: 7, y: 7, dir: 2 }, // center of home block, facing west
      ],
      tick: 0,
    };
  },

  view(state: TerritoryState, playerIndex: number): WorldView {
    const me = state.cursors[playerIndex];
    const enemy = state.cursors[1 - playerIndex];
    return {
      me: {
        position: [me.x, me.y] as [number, number],
        direction: me.dir,
        ownedCount: countOwned(state.grid, playerIndex),
      },
      enemy: {
        position: [enemy.x, enemy.y] as [number, number],
      },
      grid: state.grid,
      tick: state.tick,
    };
  },

  step(
    state: TerritoryState,
    cmds: (Cmd | null)[],
  ): { state: TerritoryState; events: TickEvent[] } {
    const events: TickEvent[] = [];

    // Clone state
    const newGrid: number[][] = state.grid.map(row => [...row]);
    const newCursors: [
      { x: number; y: number; dir: number },
      { x: number; y: number; dir: number },
    ] = [
      { ...state.cursors[0] },
      { ...state.cursors[1] },
    ];

    for (let i = 0; i < 2; i++) {
      const cursor = newCursors[i];
      const cmd = cmds[i];
      if (!cmd) continue;

      switch (cmd.action) {
        case 'expand': {
          const [dx, dy] = DIR[cursor.dir];
          const tx = cursor.x + dx;
          const ty = cursor.y + dy;

          if (tx < 0 || tx >= GRID || ty < 0 || ty >= GRID) break;

          if (newGrid[ty][tx] !== i) {
            const wasEnemy = newGrid[ty][tx] === (1 - i);
            newGrid[ty][tx] = i;
            events.push({
              tick: state.tick,
              type: wasEnemy ? 'steal' : 'expand',
              player: i,
              position: [tx, ty] as [number, number],
            });
          }

          cursor.x = tx;
          cursor.y = ty;
          break;
        }
        case 'turn': {
          const dir = (cmd.args?.[0] as string) || '';
          if (dir === 'left') {
            cursor.dir = (cursor.dir + 3) % 4;
            events.push({ tick: state.tick, type: 'turn', player: i, direction: cursor.dir });
          } else if (dir === 'right') {
            cursor.dir = (cursor.dir + 1) % 4;
            events.push({ tick: state.tick, type: 'turn', player: i, direction: cursor.dir });
          }
          break;
        }
        // 'skip' is no-op
      }
    }

    return {
      state: { grid: newGrid, cursors: newCursors, tick: state.tick + 1 },
      events,
    };
  },

  result(state: TerritoryState): MatchResult {
    const TOTAL = GRID * GRID; // 81
    const THRESHOLD = Math.floor(TOTAL * 0.6); // 48 — condition is >48 (i.e. >=49)

    // Mid-game 60% check
    for (let i = 0; i < 2; i++) {
      if (countOwned(state.grid, i) > THRESHOLD) {
        return { done: true, winner: i, reason: 'score' };
      }
    }

    // Max ticks reached
    if (state.tick >= MAX_TICKS) {
      const c0 = countOwned(state.grid, 0);
      const c1 = countOwned(state.grid, 1);
      if (c0 > c1) return { done: true, winner: 0, reason: 'score' };
      if (c1 > c0) return { done: true, winner: 1, reason: 'score' };
      return { done: true, winner: null, reason: 'draw' };
    }

    return { done: false, winner: null, reason: 'draw' };
  },
};
