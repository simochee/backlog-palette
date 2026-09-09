import { describe, expect, it } from 'vitest';
import { detectConditions } from './detectConditions.ts';

const vocab = { statusNames: ['未対応', '処理中', '処理済み', '完了', 'レビュー中'] };
const detect = (input: string) => detectConditions(input, vocab);

describe('ステータス名の切り出し', () => {
  it('ステータス名と完全一致する語は条件になり、残りが検索語になる', () => {
    expect(detect('処理中 決済')).toEqual({
      conditions: [{ field: 'status', value: '処理中', source: '処理中' }],
      keyword: '決済',
    });
  });

  it('語の順序が違っても切り出せる', () => {
    expect(detect('決済 処理中').keyword).toBe('決済');
  });

  it('カスタムステータスも語彙にあれば切り出せる', () => {
    expect(detect('レビュー中 認証').conditions[0]?.value).toBe('レビュー中');
  });

  it('全角スペースでも語を区切れる', () => {
    expect(detect('処理中　決済').keyword).toBe('決済');
  });

  it('表記が揺れていても語彙の表記で返す', () => {
    expect(detect('ﾚﾋﾞｭｰ中 認証').conditions[0]?.value).toBe('レビュー中');
  });
});

describe('条件にしないもの', () => {
  it('ステータス名を含むだけの語は条件にしない', () => {
    expect(detect('完了報告書')).toEqual({ conditions: [], keyword: '完了報告書' });
  });

  it('語彙に無い語は条件にしない', () => {
    expect(detect('至急 決済').conditions).toEqual([]);
  });

  it('担当者や種別は見ない', () => {
    expect(detect('自分の 決済').conditions).toEqual([]);
  });
});

describe('条件は 1 つだけ', () => {
  it('2 つ目のステータス名は語句のまま残す', () => {
    expect(detect('処理中 完了 決済')).toEqual({
      conditions: [{ field: 'status', value: '処理中', source: '処理中' }],
      keyword: '完了 決済',
    });
  });
});

describe('端の入力', () => {
  it('空の入力では何も起きない', () => {
    expect(detect('   ')).toEqual({ conditions: [], keyword: '' });
  });

  it('ステータス名だけを打つと検索語が空になる', () => {
    expect(detect('処理中')).toEqual({
      conditions: [{ field: 'status', value: '処理中', source: '処理中' }],
      keyword: '',
    });
  });

  it('語彙が空なら何も条件にしない', () => {
    expect(detectConditions('処理中 決済', { statusNames: [] }).keyword).toBe('処理中 決済');
  });
});
