// Curated example bots. Each value is the full JavaScript source as raw text
// (loaded via Vite's `?raw` import). This way the engine can paste them
// directly into the editor without any bundling magic.

import aggressiveShooter from './aggressive-shooter.js?raw';
import coward from './coward.js?raw';
import starHunter from './star-hunter.js?raw';
import randomWalker from './random-walker.js?raw';
import territorySweep from './territory-sweep.js?raw';
import territoryMixer from './territory-mixer.js?raw';
import loopBot from './loop-bot.js?raw';
import throwBot from './throw-bot.js?raw';

export interface ExampleEntry {
  id: string;
  name: string;
  mode: 'grid-duel' | 'territory';
  description: string;
  code: string;
}

export const examples: ExampleEntry[] = [
  { id: 'aggressive-shooter', name: 'Aggressive Shooter', mode: 'grid-duel',
    description: 'Fires whenever possible, otherwise moves forward.', code: aggressiveShooter },
  { id: 'coward', name: 'Coward', mode: 'grid-duel',
    description: 'Turns left if no bullet is loaded, otherwise fires.', code: coward },
  { id: 'star-hunter', name: 'Star Hunter', mode: 'grid-duel',
    description: 'Navigates to the star; falls back to firing at the enemy.', code: starHunter },
  { id: 'random-walker', name: 'Random Walker', mode: 'grid-duel',
    description: '50% move, 50% turn left. Uses the seeded PRNG.', code: randomWalker },
  { id: 'territory-sweep', name: 'Territory Sweep', mode: 'territory',
    description: 'Always expands straight ahead.', code: territorySweep },
  { id: 'territory-mixer', name: 'Territory Mixer', mode: 'territory',
    description: 'Expands three times, then turns right.', code: territoryMixer },
  { id: 'loop-bot', name: 'Loop Bot (DEMO)', mode: 'grid-duel',
    description: 'Infinite loop — loses with reason "runtime".', code: loopBot },
  { id: 'throw-bot', name: 'Throw Bot (DEMO)', mode: 'grid-duel',
    description: 'Throws on every tick — loses with reason "error".', code: throwBot },
];

export const exampleById = (id: string): ExampleEntry | undefined =>
  examples.find(e => e.id === id);

export const examplesById: Record<string, ExampleEntry> = Object.fromEntries(
  examples.map(e => [e.id, e]),
);
