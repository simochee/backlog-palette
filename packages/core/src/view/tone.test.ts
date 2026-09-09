import { describe, expect, it } from 'vitest';
import { issueTypeTone, statusTone, toneFromColor } from './tone.ts';

describe('ステータスの色づけ', () => {
  it('組み込みの 4 ステータスは固定の tone になる', () => {
    expect(statusTone({ id: 1 })).toBe('neutral');
    expect(statusTone({ id: 2 })).toBe('info');
    expect(statusTone({ id: 3 })).toBe('success');
    expect(statusTone({ id: 4 })).toBe('done');
  });

  it('カスタムステータスは設定色に最も近い tone になる', () => {
    expect(statusTone({ id: 12, color: '#2196f3' })).toBe('info');
    expect(statusTone({ id: 13, color: '#e02525' })).toBe('danger');
    expect(statusTone({ id: 14, color: '#4caf50' })).toBe('success');
  });

  it('色を持たないカスタムステータスは無彩色として扱う', () => {
    expect(statusTone({ id: 15 })).toBe('neutral');
  });

  it('彩度のない色は無彩色として扱う', () => {
    expect(toneFromColor('#888888')).toBe('neutral');
  });

  it('解釈できない色は無彩色に落とす', () => {
    expect(toneFromColor('rebeccapurple')).toBe('neutral');
  });
});

describe('課題種別の色づけ', () => {
  it('既定の種別は種別ごとに固定の tone になる', () => {
    expect(issueTypeTone('バグ')).toBe('danger');
    expect(issueTypeTone('タスク')).toBe('success');
  });

  it('プロジェクト独自の種別は無彩色に落とす', () => {
    expect(issueTypeTone('デザインレビュー')).toBe('neutral');
  });
});
