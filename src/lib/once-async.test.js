import { describe, expect, it } from 'vitest';
import { onceAsync } from './once-async.js';

describe('onceAsync', () => {
  it('shares one in-flight call across concurrent callers', async () => {
    let starts = 0;
    const run = onceAsync(async () => {
      starts += 1;
      await Promise.resolve();
      return 'graph';
    });
    const [a, b] = await Promise.all([run(), run()]);
    expect(a).toBe('graph');
    expect(b).toBe('graph');
    expect(starts).toBe(1);
  });

  it('returns the same settled result on later calls', async () => {
    const run = onceAsync(async () => 7);
    expect(await run()).toBe(7);
    expect(await run()).toBe(7);
  });

  it('allows a retry after failure', async () => {
    let starts = 0;
    const run = onceAsync(async () => {
      starts += 1;
      if (starts === 1) throw new Error('tone blocked');
      return 'ok';
    });
    await expect(run()).rejects.toThrow('tone blocked');
    expect(await run()).toBe('ok');
    expect(starts).toBe(2);
  });
});
