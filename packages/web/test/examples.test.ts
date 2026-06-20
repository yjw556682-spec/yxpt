import { describe, it, expect } from 'vitest';
import { examples, exampleById } from '../src/examples/index.js';

describe('Example bots', () => {
  it('exports exactly 8 example entries', () => {
    expect(examples.length).toBe(8);
  });

  it('each example has a unique id, a mode, and a non-empty code field', () => {
    const ids = new Set<string>();
    for (const ex of examples) {
      expect(ex.id.length).toBeGreaterThan(0);
      expect(ids.has(ex.id)).toBe(false);
      ids.add(ex.id);
      expect(['grid-duel', 'territory']).toContain(ex.mode);
      expect(ex.code.length).toBeGreaterThan(0);
    }
  });

  it('every example source defines an onTick function', () => {
    for (const ex of examples) {
      // Strip line comments first (the throw-bot and loop-bot files use
      // multi-line `//` blocks before onTick) and confirm `function onTick`
      // appears in the body.
      const stripped = ex.code.replace(/\/\/.*$/gm, '');
      expect(stripped).toMatch(/function\s+onTick\s*\(/);
    }
  });

  it('exampleById returns the right entry for each id', () => {
    for (const ex of examples) {
      expect(exampleById(ex.id)).toBe(ex);
    }
    expect(exampleById('does-not-exist')).toBeUndefined();
  });

  it('includes the documented demo bots (loop-bot, throw-bot)', () => {
    expect(exampleById('loop-bot')).toBeDefined();
    expect(exampleById('throw-bot')).toBeDefined();
    expect(exampleById('aggressive-shooter')).toBeDefined();
    expect(exampleById('territory-sweep')).toBeDefined();
  });
});