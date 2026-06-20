import ivm from 'isolated-vm';
import type { Cmd, WorldView } from '@yxpt/shared-types';

const PRNG_BOOTSTRAP = (seed: number) => `
var __ivm_state = ${seed >>> 0} | 0;
Math.random = function ivm_prng() {
  __ivm_state |= 0;
  __ivm_state = (__ivm_state + 0x6D2B79F5) | 0;
  var t = Math.imul(__ivm_state ^ (__ivm_state >>> 15), 1 | __ivm_state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
`;

const SANDBOX_WRAPPER = `
Date.now = function() { return 0; };
delete globalThis.fetch;
delete globalThis.setTimeout;
delete globalThis.setInterval;
delete globalThis.clearTimeout;
delete globalThis.clearInterval;
`;

export class BotSandbox {
  private isolate: ivm.Isolate;
  private context: ivm.Context;
  private disposed = false;

  private constructor(isolate: ivm.Isolate, context: ivm.Context) {
    this.isolate = isolate;
    this.context = context;
  }

  static async create(code: string, seed: number): Promise<BotSandbox> {
    const isolate = new ivm.Isolate({ memoryLimit: 8 });
    const context = await isolate.createContext();

    // Seed PRNG into the isolate
    const prngScript = isolate.compileScript(PRNG_BOOTSTRAP(seed));
    await (await prngScript).run(context);

    // Apply sandbox restrictions
    const sbxScript = isolate.compileScript(SANDBOX_WRAPPER);
    await (await sbxScript).run(context);

    // Compile and run the user's bot code
    const userScript = isolate.compileScript(code);
    await (await userScript).run(context);

    // Verify onTick exists and is callable
    const onTickType = await context.eval('typeof onTick');
    if (onTickType !== 'function') {
      isolate.dispose();
      throw { kind: 'error' as const };
    }

    return new BotSandbox(isolate, context);
  }

  async tick(me: WorldView, world: WorldView): Promise<Cmd | null> {
    if (this.disposed) {
      throw { kind: 'error' as const };
    }

    try {
      const result = await this.context.evalClosure(
        'return onTick($0, $1)',
        [me, world],
        {
          timeout: 50,
          arguments: { copy: true },
          result: { copy: true, promise: true },
        },
      );

      if (result && typeof result === 'object' && 'action' in result) {
        return result as Cmd;
      }
      return null;
    } catch (err: unknown) {
      const errObj = err as { message?: string };
      if (errObj.message?.toLowerCase().includes('timed out')) {
        throw { kind: 'runtime' as const };
      }
      throw { kind: 'error' as const };
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    try {
      this.context.release();
    } catch { /* already released */ }
    try {
      this.isolate.dispose();
    } catch { /* already disposed */ }
  }
}
