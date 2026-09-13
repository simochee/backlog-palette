import { decodeSearchState, hasConditions, type SearchScope, type SearchState } from '@/lib/share';
import type { Scope } from '@/lib/stack/types';

/**
 * 検索状態はスペースの中でだけ意味を持つ（D-20）。根のスコープは共有も復元もできないので、
 * 共有 URL を組める状態かどうかをこの関数が表す
 */
export function shareScopeOf(scope: Scope): SearchScope | undefined {
  return scope.kind === 'root' ? undefined : scope;
}

export type Restore = {
  query: string;
  scope: Scope;
  /** 条件を持つ状態はサイドパネルで復元する（surfaces.md §5.1） */
  toPanel: boolean;
  state: SearchState;
};

/**
 * ページの URL から検索状態を復元する（palette.md §7.6）。フラグメントはページ由来の値なので
 * 認証の選択には使わない。スペースの決定はタブ URL のホストが担い、ここは語・スコープ・条件だけ
 * を受け取る。復元先のスペースが今のタブと違うときは復元しない（別スペースの共有 URL を
 * 今のスペースの鍵で引いてしまう）
 */
export function restoreFrom(href: string, spaceHost: string): Restore | undefined {
  const decoded = decodeSearchState(href);
  if (!decoded.ok) return undefined;
  const state = decoded.shared.value;
  if (state.scope.spaceId !== spaceHost) return undefined;
  return { query: state.query, scope: state.scope, toPanel: hasConditions(state), state };
}
