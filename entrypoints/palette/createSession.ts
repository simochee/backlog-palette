import type { Labels } from '@/components/labels';
import { resolveLanguage } from '@/lib/i18n/language';
import type { AssignedState, PaletteIndex } from '@/lib/palette';
import type { Stack } from '@/lib/stack/types';
import { settings } from '@/lib/storage/palette-items';
import type { Readable } from '@/lib/store';

import { assignedStoreFor } from './assigned.ts';
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
