import { describe, expect, it } from 'vitest';

import { buildShareUrl, decodeSearchState, encodeSearchState, SHARE_FRAGMENT_KEY } from './codec';
import { hasConditions, type SearchState, searchState } from './schema';

const space = { kind: 'space', spaceId: 'nulab' } as const;
const project = { kind: 'project', spaceId: 'nulab', projectId: '1' } as const;

const roundTrip = (state: SearchState) => {
  const result = decodeSearchState(`#${SHARE_FRAGMENT_KEY}=${encodeSearchState(state)}`);
  if (!result.ok) throw new Error(result.reason);
  return result.shared.value;
};

describe('往復', () => {
  it('語とスコープだけの状態は往復で同じになる', () => {
    const state = searchState('ログイン', project);
    expect(roundTrip(state)).toEqual(state);
  });

  it('日本語と記号を含む語も壊れない', () => {
    expect(roundTrip(searchState('決済 "エラー" & 再試行 / 100%', space)).query).toBe(
      '決済 "エラー" & 再試行 / 100%',
    );
  });

  it('条件を持つ状態は条件ごと往復する', () => {
    const state = searchState('ログイン', space, {
      type: 'wiki',
      status: { kind: 'status', statusId: 3 },
      assignee: 'me',
      updated: 'week',
    });
    expect(roundTrip(state)).toEqual(state);
  });

  it('既定値の条件はペイロードに載らず、復元側が既定値で補う', () => {
    const encoded = encodeSearchState(searchState('q', space));
    const json = Buffer.from(
      encoded.replaceAll('-', '+').replaceAll('_', '/'),
      'base64',
    ).toString();
    expect(JSON.parse(json)).toEqual({ v: 1, query: 'q', scope: space });
    expect(roundTrip(searchState('q', space)).conditions.type).toBe('all');
  });
});

describe('復元先の判定（surfaces.md §5.1）', () => {
  it('語とスコープだけならパレットで、条件を持つならパネルで復元する', () => {
    expect(hasConditions(searchState('q', space))).toBe(false);
    expect(hasConditions(searchState('q', space, { status: { kind: 'notClosed' } }))).toBe(true);
  });

  it('復元した値はページ由来だと型と値で分かる', () => {
    const result = decodeSearchState(
      buildShareUrl('https://nulab.backlog.com', searchState('q', space)),
    );
    expect(result.ok && result.shared.origin).toBe('page');
  });
});

describe('取り出しと失敗', () => {
  it('URL 全体からも location.hash からも取り出せる', () => {
    const url = buildShareUrl('https://nulab.backlog.com/', searchState('q', space));
    expect(url.startsWith('https://nulab.backlog.com/dashboard#bl-search=')).toBe(true);
    expect(decodeSearchState(url).ok).toBe(true);
    expect(decodeSearchState(new URL(url).hash).ok).toBe(true);
  });

  it('他のフラグメントと並んでいても自分の鍵だけを読む', () => {
    const encoded = encodeSearchState(searchState('q', space));
    expect(decodeSearchState(`#other=1&${SHARE_FRAGMENT_KEY}=${encoded}`).ok).toBe(true);
  });

  it('フラグメントに無ければ notPresent', () => {
    expect(decodeSearchState('https://nulab.backlog.com/dashboard')).toEqual({
      ok: false,
      reason: 'notPresent',
    });
    expect(decodeSearchState('#comment-1')).toEqual({ ok: false, reason: 'notPresent' });
  });

  it('壊れた base64 や JSON、形の違うペイロードは malformed', () => {
    expect(decodeSearchState(`#${SHARE_FRAGMENT_KEY}=%%%`).ok).toBe(false);
    expect(decodeSearchState(`#${SHARE_FRAGMENT_KEY}=${btoa('{"v":1}')}`)).toEqual({
      ok: false,
      reason: 'malformed',
    });
  });

  it('根のスコープは受け付けない（根では検索しない、D-20）', () => {
    const payload = btoa(JSON.stringify({ v: 1, query: 'q', scope: { kind: 'root' } }));
    expect(decodeSearchState(`#${SHARE_FRAGMENT_KEY}=${payload}`)).toEqual({
      ok: false,
      reason: 'malformed',
    });
  });

  it('版が違えば復元せず unsupportedVersion を返す', () => {
    const payload = btoa(JSON.stringify({ v: 2, query: 'q', scope: space }));
    expect(decodeSearchState(`#${SHARE_FRAGMENT_KEY}=${payload}`)).toEqual({
      ok: false,
      reason: 'unsupportedVersion',
    });
  });
});
