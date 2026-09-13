import type { Labels } from '@/components/labels';
import { apiKeyPageUrl } from '@/lib/connect/page';
import type { PaletteAction, RowAction } from '@/lib/palette';
import { searchKinds } from '@/lib/search';
import { buildShareUrl, searchState } from '@/lib/share';
import type { Scope } from '@/lib/stack/types';
import { navigate } from '@/lib/tabs';

import { recordNavigation } from './activity.ts';
import type { OpenContext } from './context.ts';
import { openPanelWith } from './panel.ts';
import type { SearchRunner } from './search.ts';
import { shareScopeOf } from './share.ts';
import { paletteTelemetry, track } from './telemetry.ts';

export type ActionEnv = {
  context: OpenContext;
  labels: Labels;
  learningEnabled: boolean;
  runner: SearchRunner;
  /** 入力の語と現在のスコープ。⌘→ と ⌘⇧C が対象にする */
  query: string;
  scope: Scope;
  dispatch: (action: PaletteAction) => void;
  close: () => void;
  now: () => number;
};

/** 走っている検索を 1 つだけ持つ。入力が変わったら捨てる（palette.md §7.4） */
export type SearchHandle = { cancel: () => void };

export type Pending = {
  search: SearchHandle | undefined;
  lastSearch: { query: string; scope: Scope } | undefined;
};

/** 検索の起動に要るのは実行役と dispatch だけ。復元（共有 URL）は行の動作を経ずにここへ来る */
export type SearchEnv = Pick<ActionEnv, 'runner' | 'dispatch'>;

export function startSearch(query: string, scope: Scope, env: SearchEnv): SearchHandle {
  env.dispatch({ type: 'searchStarted', query, scope });
  track({ type: 'searchStarted' });
  // 0 件率（surfaces.md §10）。全種別が届いて 1 件も無かったときだけ数える
  let settled = 0;
  let found = 0;
  const cancel = env.runner.run(query, scope, (kind, outcome) => {
    settled += 1;
    if (outcome.ok) {
      found += outcome.rows.length;
      env.dispatch({ type: 'resultsArrived', kind, rows: outcome.rows });
    } else env.dispatch({ type: 'searchFailed', kind, error: outcome.error });
    if (settled === searchKinds.length && found === 0) track({ type: 'searchEmpty' });
  });
  return { cancel };
}

/** 走っている検索を捨てる。入力が変わったとき（§7.4）と、次の検索を始める前 */
export function cancelSearch(pending: Pending): void {
  pending.search?.cancel();
  pending.search = undefined;
}

export function restartSearch(query: string, scope: Scope, env: SearchEnv, pending: Pending): void {
  cancelSearch(pending);
  pending.lastSearch = { query, scope };
  pending.search = startSearch(query, scope, env);
}

async function go(url: string, newTab: boolean, env: ActionEnv) {
  paletteTelemetry.navigated(env.query === '');
  if (env.learningEnabled) await recordNavigation(url, env.context, env.now(), env.query);
  await navigate(url, newTab ? 'new' : 'current');
  env.close();
}

async function copy(text: string, subject: string, env: ActionEnv) {
  // クリップボードは拡張ページで書く。埋め込み側の allow="clipboard-write" が前提（palette.md §11）
  await navigator.clipboard.writeText(text);
  env.dispatch({ type: 'toasted', toast: { message: env.labels.rows.copied(subject) } });
}

/** `⌘⇧C`（palette.md §7.6）。フッターに出るのは検索結果があるときだけ */
export async function copySearchUrl(env: ActionEnv, pending: Pending): Promise<void> {
  const last = pending.lastSearch;
  const scope = last === undefined ? undefined : shareScopeOf(last.scope);
  if (last === undefined || scope === undefined) return;
  const url = buildShareUrl(env.context.origin, searchState(last.query, scope));
  track({ type: 'searchUrlCopied' });
  await copy(url, env.labels.rows.searchUrl, env);
}

/** `⌘→` と panel 行。渡せたらパレットを閉じる（surfaces.md §5.1） */
export async function openPanel(env: ActionEnv): Promise<void> {
  track({ type: 'panelHandedOff' });
  if (await openPanelWith(env.query, env.scope)) env.close();
}

function connectUrl(spaceId: string | undefined, env: ActionEnv): string {
  return apiKeyPageUrl(spaceId === undefined ? env.context.origin : `https://${spaceId}`);
}

/** 行の ↵ で起きることを実行する（palette.md §5）。宛先の解決は derive が済ませている */
export function performAction(
  action: RowAction,
  newTab: boolean,
  env: ActionEnv,
  pending: Pending,
): Promise<void> {
  switch (action.type) {
    case 'navigate':
      return go(action.url, newTab, env);
    case 'copy':
      return copy(action.text, action.subject, env);
    case 'connect':
      return go(connectUrl(action.spaceId, env), false, env);
    case 'openPanel':
      return openPanel(env);
    case 'descend':
      env.dispatch({ type: 'descended', command: action.command });
      break;
    case 'search':
      restartSearch(action.query, action.scope, env, pending);
      break;
    case 'retry':
      if (pending.lastSearch !== undefined)
        restartSearch(pending.lastSearch.query, pending.lastSearch.scope, env, pending);
      break;
    case 'mergeHeld':
      env.dispatch({ type: 'heldMerged' });
      break;
  }
  return Promise.resolve();
}
