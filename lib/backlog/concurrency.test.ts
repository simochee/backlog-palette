import { describe, expect, it } from 'vitest';

import { mapWithConcurrency } from './concurrency';

describe('並列数を絞った map', () => {
  it('同時に走る数が上限を超えず、結果は入力の順で返る', async () => {
    let running = 0;
    let peak = 0;
    const results = await mapWithConcurrency([30, 10, 20, 5], 2, async (ms) => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((done) => {
        setTimeout(done, ms);
      });
      running -= 1;
      return ms * 2;
    });

    expect(results).toEqual([60, 20, 40, 10]);
    expect(peak).toBe(2);
  });

  it('空の入力は何も呼ばずに空を返す', async () => {
    expect(await mapWithConcurrency([], 3, () => Promise.reject(new Error('呼ばれない')))).toEqual(
      [],
    );
  });
});
