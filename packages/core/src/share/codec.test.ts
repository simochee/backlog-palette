import { describe, expect, it } from 'vitest';
import {
  buildShareUrl,
  decodeSearchState,
  encodeSearchState,
  SHARE_FRAGMENT_KEY,
} from './codec.ts';
import { defaultSearchState, type SearchState } from './searchState.ts';

const origin = 'https://nulab.backlog.com';

const fullState: SearchState = {
  v: 1,
  query: '請求書 レビュー',
  scope: { kind: 'project', spaceKey: 'nulab', projectKey: 'WEB' },
  types: ['issue', 'wiki'],
  status: { kind: 'preset', preset: 'openOnly' },
  assignee: { kind: 'user', userId: 4321 },
  issueTypeId: 77,
  updated: { kind: 'withinDays', days: 7 },
  keywordTarget: 'subjectBodyAndComment',
};

function fragmentOf(payload: string): string {
  return `#${SHARE_FRAGMENT_KEY}=${payload}`;
}

function payloadFor(value: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let latin1 = '';
  for (const byte of bytes) latin1 += String.fromCharCode(byte);
  return btoa(latin1).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function jsonIn(payload: string): unknown {
  const latin1 = atob(payload.replaceAll('-', '+').replaceAll('_', '/'));
  const bytes = Uint8Array.from(latin1, (character) => character.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

function roundTrip(state: SearchState): SearchState | undefined {
  const result = decodeSearchState(fragmentOf(encodeSearchState(state)));
  return result.ok ? result.state : undefined;
}

describe('往復', () => {
  it('日本語のクエリが往復して元に戻る', () => {
    const state: SearchState = { ...defaultSearchState, query: '請求書の締め切り 🗓' };
    expect(roundTrip(state)?.query).toBe('請求書の締め切り 🗓');
  });

  it('すべての条件を指定した状態が往復して元に戻る', () => {
    expect(roundTrip(fullState)).toEqual(fullState);
  });

  it('既定値だけの状態も往復して等価に戻る', () => {
    expect(roundTrip(defaultSearchState)).toEqual(defaultSearchState);
  });

  it('条件を 1 つだけ変えた状態も往復して等価に戻る', () => {
    const state: SearchState = { ...defaultSearchState, assignee: { kind: 'me' } };
    expect(roundTrip(state)).toEqual(state);
  });

  it('種別の並びも往復して保たれる', () => {
    const state: SearchState = { ...defaultSearchState, types: ['document', 'issue'] };
    expect(roundTrip(state)?.types).toEqual(['document', 'issue']);
  });
});

describe('ペイロード', () => {
  it('エンコード結果に URL で壊れる文字が含まれない', () => {
    expect(encodeSearchState(fullState)).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('既定値のフィールドは載せず、スキーマ版だけを残す', () => {
    expect(jsonIn(encodeSearchState(defaultSearchState))).toEqual({ v: 1 });
  });

  it('既定値から外れた条件だけが載る', () => {
    const state: SearchState = { ...defaultSearchState, updated: { kind: 'withinDays', days: 3 } };
    expect(jsonIn(encodeSearchState(state))).toEqual({
      v: 1,
      updated: { kind: 'withinDays', days: 3 },
    });
  });
});

describe('スキーマ版', () => {
  it('未知のスキーマ版は復元せず、版番号を返す', () => {
    expect(decodeSearchState(fragmentOf(payloadFor({ v: 2 })))).toEqual({
      ok: false,
      reason: 'unsupportedVersion',
      version: 2,
    });
  });

  it('スキーマ版が数値でなければ壊れた入力として扱う', () => {
    expect(decodeSearchState(fragmentOf(payloadFor({ v: 'one' })))).toEqual({
      ok: false,
      reason: 'malformed',
    });
  });
});

describe('壊れた入力', () => {
  it.each([
    ['base64url でない', fragmentOf('***')],
    ['ペイロードが空', fragmentOf('')],
    ['JSON でない', fragmentOf(payloadFor('文字列'))],
    ['必須フィールドが欠けている', fragmentOf(payloadFor({ v: 1, scope: { kind: 'space' } }))],
    ['条件の種類が未知', fragmentOf(payloadFor({ v: 1, assignee: { kind: 'team' } }))],
    [
      '条件の値の型が違う',
      fragmentOf(payloadFor({ v: 1, updated: { kind: 'withinDays', days: '7' } })),
    ],
    ['種別に未知の値が混ざる', fragmentOf(payloadFor({ v: 1, types: ['issue', 'file'] }))],
  ])('%s ペイロードは例外を投げずに malformed を返す', (_, input) => {
    expect(() => decodeSearchState(input)).not.toThrow();
    expect(decodeSearchState(input)).toEqual({ ok: false, reason: 'malformed' });
  });
});

describe('フラグメントの取り出し', () => {
  it('フラグメントの無い URL は notPresent を返す', () => {
    expect(decodeSearchState(`${origin}/dashboard`)).toEqual({ ok: false, reason: 'notPresent' });
  });

  it('別のフラグメントしか無い URL も notPresent を返す', () => {
    expect(decodeSearchState(`${origin}/dashboard#comment-1`)).toEqual({
      ok: false,
      reason: 'notPresent',
    });
  });

  it('location.hash だけを渡しても復元できる', () => {
    const hash = `#other=1&${SHARE_FRAGMENT_KEY}=${encodeSearchState(fullState)}`;
    expect(decodeSearchState(hash)).toEqual({ ok: true, state: fullState });
  });
});

describe('共有 URL', () => {
  it('拡張なしでも開ける Backlog のページを指す', () => {
    const [page = ''] = buildShareUrl(origin, fullState).split('#');
    expect(page).toBe(`${origin}/dashboard`);
  });

  it('条件はフラグメントに載せる', () => {
    expect(buildShareUrl(origin, fullState)).toBe(
      `${origin}/dashboard#${SHARE_FRAGMENT_KEY}=${encodeSearchState(fullState)}`,
    );
  });

  it('組み立てた URL をそのまま復元できる', () => {
    expect(decodeSearchState(buildShareUrl(origin, fullState))).toEqual({
      ok: true,
      state: fullState,
    });
  });

  it('末尾にスラッシュのあるオリジンでもパスが二重にならない', () => {
    expect(buildShareUrl(`${origin}/`, defaultSearchState)).toBe(
      buildShareUrl(origin, defaultSearchState),
    );
  });
});
