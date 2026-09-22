import { describe, expect, it } from 'vitest';

import { ja } from '@/components/labels/ja';

import { dueBadge } from './due';

const now = Date.parse('2026-09-22T09:00:00Z');

describe('期限のバッジ（§5）', () => {
  it('期限が無ければ出さない', () => {
    expect(dueBadge(undefined, now, ja)).toBeUndefined();
  });

  it('期限切れは「期限切れ」を危険色で出す', () => {
    expect(dueBadge('2026-09-21', now, ja)).toEqual({ label: ja.rows.overdue, tone: 'danger' });
  });

  it('今日は期限切れにしない', () => {
    expect(dueBadge('2026-09-22', now, ja)).toEqual({
      label: ja.rows.dueOn(9, 22),
      tone: 'warning',
    });
  });

  it('7 日以内は日付を警告色で出す', () => {
    expect(dueBadge('2026-09-29', now, ja)).toEqual({
      label: ja.rows.dueOn(9, 29),
      tone: 'warning',
    });
  });

  it('8 日以上先は出さない。今日やることの判断に効かない', () => {
    expect(dueBadge('2026-09-30', now, ja)).toBeUndefined();
  });

  it('時刻つきの値も日付だけで判定する', () => {
    expect(dueBadge('2026-09-29T23:59:59Z', now, ja)?.tone).toBe('warning');
  });

  it('日付として読めない値は出さない', () => {
    expect(dueBadge('いつか', now, ja)).toBeUndefined();
  });
});
