import type { GameMode } from '@yxpt/shared-types';
import { gridDuel } from './gridDuel.js';
import { territory } from './territory.js';

export const modes: Record<string, GameMode> = {
  'grid-duel': gridDuel,
  territory,
};

export function getMode(id: string): GameMode {
  const mode = modes[id];
  if (!mode) throw new Error(`Unknown game mode: ${id}`);
  return mode;
}
