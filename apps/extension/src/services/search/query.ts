import { normalize, type SearchResultType, type SearchState } from '@backlog-palette/core';
import type {
  DocumentSearchParams,
  IssueSearchParams,
  NonEmpty,
  WikiSearchParams,
} from '../backlog/types.ts';
import type { SearchRow } from './rows.ts';

/**
 * `SearchState` を API の引数と行の絞り込みへ翻訳する（実装プラン §3 D5・§7.4）。
 *
 * 検索条件の型はここで作らない。`packages/core` の `SearchState` が正典で、
 * この層は「その条件を Backlog の API でどう表すか」だけを持つ。
 */

/** 1 スペース・1 種別あたりの取得件数。§14 の「最初の結果 ≤ 1s」に合わせた上限 */
export const SPACE_RESULT_LIMIT = 20;

/**
 * 「完了を除く」は組み込みステータスの id で表す。
 *
 * 本来はプロジェクトのステータス一覧から完了以外を列挙するのが正しいが、
 * それはプロジェクトごとに 1 リクエスト増える。カスタムステータスを持つ
 * プロジェクトでは取りこぼすので、マスタが揃ったらそちらを使う。
 */
const OPEN_STATUS_IDS: readonly number[] = [1, 2, 3];

const DAY_MS = 24 * 60 * 60 * 1000;

export function keywordOf(state: SearchState): string {
  return state.query.trim();
}

/** ステータス・担当者・種別は課題にしかない条件。指定されていれば課題だけが答えになる */
function hasIssueOnlyFilter(state: SearchState): boolean {
  return (
    state.status.kind !== 'any' || state.assignee.kind !== 'any' || state.issueTypeId !== undefined
  );
}

export function wantsType(state: SearchState, type: SearchResultType): boolean {
  if (!state.types.includes(type)) return false;
  if (type === 'issue') return true;
  if (hasIssueOnlyFilter(state)) return false;

  /*
   * Wiki 一覧は `count` が効かず全件返る（台帳 §6.3）。キーワードが無いときは
   * 引かないことでしか件数を抑えられない。
   */
  return type === 'document' || keywordOf(state) !== '';
}

function statusIds(state: SearchState): readonly number[] | undefined {
  if (state.status.kind === 'status') return [state.status.statusId];
  return state.status.kind === 'preset' ? OPEN_STATUS_IDS : undefined;
}

/** `updatedSince` は日付だけを取る */
function updatedSince(state: SearchState, now: number): string | undefined {
  if (state.updated.kind !== 'withinDays') return undefined;
  return new Date(now - state.updated.days * DAY_MS).toISOString().slice(0, 10);
}

export function issueParams(options: {
  state: SearchState;
  projectId: NonEmpty<number>;
  assigneeId: number | undefined;
  now: number;
}): IssueSearchParams {
  const { state, projectId, assigneeId, now } = options;
  const keyword = keywordOf(state);
  const status = statusIds(state);
  const since = updatedSince(state, now);

  return {
    projectId,
    ...(keyword === '' ? {} : { keyword }),
    ...(status === undefined ? {} : { statusId: status }),
    ...(assigneeId === undefined ? {} : { assigneeId: [assigneeId] }),
    ...(state.issueTypeId === undefined ? {} : { issueTypeId: [state.issueTypeId] }),
    ...(since === undefined ? {} : { updatedSince: since }),
    count: SPACE_RESULT_LIMIT,
    sort: 'updated',
    order: 'desc',
  };
}

export function documentParams(state: SearchState, projectIds: NonEmpty<number>) {
  const keyword = keywordOf(state);

  return {
    projectIds,
    offset: 0,
    count: SPACE_RESULT_LIMIT,
    sort: 'updated',
    order: 'desc',
    ...(keyword === '' ? {} : { keyword }),
  } satisfies DocumentSearchParams;
}

export function wikiParams(state: SearchState, projectId: number): WikiSearchParams {
  return { projectIdOrKey: projectId, keyword: keywordOf(state) };
}

/**
 * 取得後に落とす行を決める。
 *
 * キーワード対象を API に伝える手段が無い（`keyword` は常に本文とコメントにも
 * 一致する。台帳 §6.1）ので、「件名」「件名・本文」を選んだときだけこちらで狭める。
 * 更新日はドキュメントと Wiki の一覧が期間を取らないため、同じ場所で揃える。
 */
export function rowFilter(state: SearchState, now: number): (row: SearchRow) => boolean {
  const keyword = normalize(keywordOf(state));
  const cutoff =
    state.updated.kind === 'withinDays' ? now - state.updated.days * DAY_MS : undefined;

  return (row) => {
    if (cutoff !== undefined && row.updatedAt < cutoff) return false;
    if (keyword === '' || state.keywordTarget === 'subjectBodyAndComment') return true;
    if (normalize(row.title).includes(keyword)) return true;

    return (
      state.keywordTarget === 'subjectAndBody' &&
      row.body !== undefined &&
      normalize(row.body).includes(keyword)
    );
  };
}
