import { browser } from '#imports';
import type { Labels } from '@/components/labels';
import { apiKeyPageUrl } from '@/lib/connect/page';
import type { PaletteAction, RowAction } from '@/lib/palette';
import type { Scope } from '@/lib/stack/types';
import { navigate, readCurrentTab } from '@/lib/tabs';

import { recordNavigation } from './activity.ts';
import type { OpenContext } from './context.ts';
import type { SearchRunner } from './search.ts';

export type ActionEnv = {
  context: OpenContext;
  labels: Labels;
  learningEnabled: boolean;
  runner: SearchRunner;
  dispatch: (action: PaletteAction) => void;
  close: () => void;
  now: () => number;
};

/** 走っている検索を 1 つだけ持つ。入力が変わったら捨てる（palette.md §7.4） */
export type SearchHandle = { cancel: () => void };

export function startSearch(query: string, scope: Scope, env: ActionEnv): SearchHandle {
  env.dispatch({ type: 'searchStarted', query, scope });
  const cancel = env.runner.run(query, scope, (kind, outcome) => {
    if (outcome.ok) env.dispatch({ type: 'resultsArrived', kind, rows: outcome.rows });
    else env.dispatch({ type: 'searchFailed', kind, error: outcome.error });
  });
  return { cancel };
}

async function go(url: string, newTab: boolean, env: ActionEnv) {
  if (env.learningEnabled) await recordNavigation(url, env.context, env.now());
  await navigate(url, newTab ? 'new' : 'current');
  env.close();
}

async function copy(text: string, subject: string, env: ActionEnv) {
  // クリップボードは拡張ページで書く。埋め込み側の allow="clipboard-write" が前提（palette.md §11）
  await navigator.clipboard.writeText(text);
  env.dispatch({ type: 'toasted', toast: { message: env.labels.rows.copied(subject) } });
}

/*
 * サイドパネルはユーザー操作の中でしか開けない。パレットの ↵ は拡張ページ内の操作なので通る。
 * Firefox は sidebarAction をスクリプトから開けず、そのときは panel 行を出さない（surfaces.md §5.5）
 */
async function openPanel(env: ActionEnv) {
  const tab = await readCurrentTab();
  if (tab?.id !== undefined && 'sidePanel' in browser) await browser.sidePanel.open({ tabId: tab.id });
  env.close();
}

export type Pending = {
  search: SearchHandle | undefined;
  lastSearch: { query: string; scope: Scope } | undefined;
};

/** 行の ↵ で起きることを実行する（palette.md §5）。宛先の解決は derive が済ませている */
/** 走っている検索を捨てる。入力が変わったとき（§7.4）と、次の検索を始める前 */
export function cancelSearch(pending: Pending): void {
  pending.search?.cancel();
  pending.search = undefined;
}

function restartSearch(query: string, scope: Scope, env: ActionEnv, pending: Pending) {
  cancelSearch(pending);
  pending.lastSearch = { query, scope };
  pending.search = startSearch(query, scope, env);
}

function connectUrl(spaceId: string | undefined, env: ActionEnv): string {
  return apiKeyPageUrl(spaceId === undefined ? env.context.origin : `https://${spaceId}`);
}

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
