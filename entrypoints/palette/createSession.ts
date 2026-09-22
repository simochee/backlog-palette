import { createStore } from '@tanstack/store';

import type { Labels } from '@/components/labels';
import { toApiFailure } from '@/lib/backlog/failure';
import { resolveLanguage } from '@/lib/i18n/language';
import type { AssignedState, PaletteIndex } from '@/lib/palette';
import type { Stack } from '@/lib/stack/types';
import { settings } from '@/lib/storage/palette-items';
import type { Readable } from '@/lib/store';

import { backlog } from './backlog.ts';
import { buildIndex } from './buildIndex.ts';
import { initialStackOf, type OpenContext, readOpenContext } from './context.ts';
import { labelsFor } from './language.ts';
import { revalidateInBackground } from './revalidate.ts';
import type { SearchRunner } from './search.ts';
import { type Restore, restoreFrom } from './share.ts';
import { readConnectedSpaces } from './spaces.ts';

/**
 * 開く前に用意しておく材料。iframe が読み込まれた時点と閉じた時点で作り、`⌘K` を待たずに
 * パレットを描いておく（palette.md §3 の 100ms 予算）。
 *
 * Store はここに含めない。用意し直すたびに Store ごと入れ替わると、それまでに打った文字が
 * 消える（開いた直後に用意が終わると起きる）
 */
export type PaletteSession = {
  context: OpenContext;
  index: PaletteIndex;
  labels: Labels;
  /** 開いたときのスタック。現在ページから決まる */
  stack: Stack;
  /** 共有 URL で開いたときに復元する検索（palette.md §7.6） */
  restore: Restore | undefined;
  runner: SearchRunner;
  /**
   * 担当課題。API から届いたら空状態の末尾に足す（palette.md §9）。
   * promise にして use() で待つと、届くまでパレットごと描けない。表示キャッシュだけで先に描く
   */
  assigned: Readable<AssignedState>;
};

/*
 * 失敗しても空状態は描く。失敗は担当課題のセクションの中の行になる（I6・D-38）。
 * 分類を捨てて undefined を返すと、取れなかったときに「読み込み中」が回り続ける
 */
async function assignedFor(host: string, connected: boolean): Promise<AssignedState> {
  // 未接続のスペースでは空状態が接続行になり、担当課題のセクションは出ない（§9）
  if (!connected) return { kind: 'ready', rows: [] };
  try {
    const rows = await backlog.queryClient.query(backlog.queries.assignedIssues(host));
    return { kind: 'ready', rows };
  } catch (error) {
    return { kind: 'failed', error: toApiFailure(error) };
  }
}

function assignedStoreFor(host: string, connected: boolean): Readable<AssignedState> {
  const store = createStore<AssignedState>({ kind: 'loading' });
  void assignedFor(host, connected).then((state) => store.setState(() => state));
  return store;
}

export async function createSession(): Promise<PaletteSession | undefined> {
  const context = await readOpenContext();
  // スペースの URL でなければパレットを持たない。content script の判定と二重に守る（I7）
  if (context === undefined) return undefined;
  const now = Date.now();
  const [connected, prefs] = await Promise.all([readConnectedSpaces(), settings.getValue()]);
  const language = resolveLanguage(prefs.language, navigator.language);
  const index = await buildIndex({ context, connected, settings: prefs, language, now });

  revalidateInBackground(index, context.spaceHost, connected.has(context.spaceHost));

  return {
    context,
    index,
    labels: labelsFor(language),
    stack: initialStackOf(context, connected.get(context.spaceHost)),
    restore: restoreFrom(context.href, context.spaceHost),
    runner: backlog.runner,
    assigned: assignedStoreFor(context.spaceHost, connected.has(context.spaceHost)),
  };
}
