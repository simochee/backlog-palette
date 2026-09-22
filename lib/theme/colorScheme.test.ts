import { describe, expect, it } from 'vitest';

import { colorSchemeFrom } from './colorScheme';

describe('ページから届いたテーマ', () => {
  it('dark ならダークになる', () => {
    expect(colorSchemeFrom('dark')).toBe('dark');
  });

  it('light ならライトになる', () => {
    expect(colorSchemeFrom('light')).toBe('light');
  });

  it('届かなかったり知らない値だったりしたらライトになる', () => {
    expect(colorSchemeFrom(null)).toBe('light');
    expect(colorSchemeFrom('system')).toBe('light');
    expect(colorSchemeFrom(1)).toBe('light');
  });
});
