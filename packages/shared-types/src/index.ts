export type Cmd = { action: string; args?: unknown[] };

export type WorldView = Record<string, unknown>;

export interface TickEvent {
  tick: number;
  type: string;
  [k: string]: unknown;
}

export interface MatchResult {
  done: boolean;
  winner: number | null;
  reason: 'destroyed' | 'score' | 'timeout' | 'runtime' | 'error' | 'draw';
}

export interface GameMode<S = unknown> {
  id: string;
  name: string;
  maxPlayers: number;
  maxTicks: number;
  init(seed: number, playerIds: string[]): S;
  view(state: S, playerIndex: number): WorldView;
  step(state: S, cmds: (Cmd | null)[]): { state: S; events: TickEvent[] };
  result(state: S): MatchResult;
}

export interface ReplayMeta {
  modeId: string;
  seed: number;
  players: string[];
  codeHashes: string[];
}

export interface Replay {
  meta: ReplayMeta;
  events: TickEvent[];
  result: MatchResult;
}
