import { useCallback, useEffect, useRef, useState } from 'react';

import type { Labels } from '@/components/labels';
import type { HostChannel } from '@/lib/messaging/hostChannel';
import { createPaletteStore, type PaletteIndex, type PaletteStore } from '@/lib/palette';
import type { Stack } from '@/lib/stack/types';
import { settings } from '@/lib/storage/palette-items';

import { type Pending, restartSearch } from './actions.ts';
import { buildIndex } from './buildIndex.ts';
import { initialStackOf, type OpenContext, readOpenContext } from './context.ts';
import { labelsFor, resolveLanguage } from './language.ts';
import { handOffToPanel } from './panel.ts';
import { emptySearchRunner, type SearchRunner } from './search.ts';
import { type Restore, restoreFrom } from './share.ts';
import { readConnectedSpaces } from './spaces.ts';

/**
 * 開く前に用意しておくもの。iframe が読み込まれた時点と閉じた時点で作り、`⌘K` を待たずに
 * パレットを描いておく（palette.md §3 の 100ms 予算）。`open` は状態を開いた形に戻すだけ
 */
export type PaletteSession = {
  context: OpenContext;
  index: PaletteIndex;
  labels: Labels;
  store: PaletteStore;
  runner: SearchRunner;
  /** 開いたときのスタック。現在ページから決まる */
  stack: Stack;
  /** 共有 URL で開いたときに復元する検索（palette.md §7.6） */
  restore: Restore | undefined;
  /** 走っている検索。入力が変わったら捨てる */
  pending: Pending;
};

async function createSession(): Promise<PaletteSession | undefined> {
  const context = await readOpenContext();
  // スペースの URL でなければパレットを持たない。content script の判定と二重に守る（I7）
  if (context === undefined) return undefined;
  const now = Date.now();
  const [connected, prefs] = await Promise.all([readConnectedSpaces(), settings.getValue()]);
  const language = resolveLanguage(prefs.language, navigator.language);
  const index = await buildIndex({ context, connected, settings: prefs, language, now });
  document.documentElement.dataset.colorScheme = prefs.theme === 'system' ? undefined : prefs.theme;

  const stack = initialStackOf(context, connected.get(context.spaceHost));
  const store = createPaletteStore();
  store.dispatch({ type: 'opened', stack });
  return {
    context,
    index,
    labels: labelsFor(language),
    store,
    runner: emptySearchRunner,
    stack,
    restore: restoreFrom(context.href, context.spaceHost),
    pending: { search: undefined, lastSearch: undefined },
  };
}

/*
 * 開くたびに状態を開いた形へ戻す。前回の入力・選択・検索は残さない（palette.md §3）。
 * 共有 URL で開いたときはここで復元する。条件つきはサイドパネルへ渡し、開けない環境
 * （Firefox）では語とスコープだけパレットで復元する（surfaces.md §5.1・§5.5）
 */
function applyOpen(session: PaletteSession, close: () => void): void {
  const { store, restore } = session;
  store.dispatch({ type: 'opened', stack: session.stack });
  if (restore === undefined) return;

  void (async () => {
    if (restore.toPanel && (await handOffToPanel(restore.state))) {
      close();
      return;
    }
    store.dispatch({ type: 'inputChanged', value: restore.query });
    restartSearch(
      restore.query,
      restore.scope,
      { runner: session.runner, dispatch: store.dispatch },
      session.pending,
    );
  })();
}

/**
 * content script の open / close に合わせてセッションを保つ。
 *
 * セッションは `open` を待たずに作る。待ってから描くと、iframe が表示された直後の打鍵が
 * まだ存在しない入力欄に届かず落ちる（mvp の罠と同じ形）。閉じている間も描いておき、
 * content script の `iframe.focus()` がそのまま入力欄のフォーカスになる
 */
/**
 * セッションの用意と保持。用意は非同期なので、進行中のものと最新のものを ref で持つ。
 *
 * 開いている間は差し替えない。開いた後に用意が終わって store が入れ替わると、それまでに
 * 打った文字が消える。ただし 1 つ目の用意は差し替えないと描くものが無い（共有 URL の
 * ページは読み込み直後に開くので、用意より先に open が来る）
 */
function useSessionSupply() {
  const [session, setSession] = useState<PaletteSession>();
  const latest = useRef<PaletteSession | null>(null);
  const inflight = useRef<Promise<PaletteSession | undefined> | null>(null);
  const isOpen = useRef(false);

  const refresh = useCallback(async () => {
    const pending = createSession();
    inflight.current = pending;
    const next = await pending;
    if (isOpen.current && latest.current !== null) return next;
    latest.current = next ?? null;
    setSession(next);
    return next;
  }, []);

  const markOpen = useCallback((open: boolean) => {
    isOpen.current = open;
  }, []);

  return { session, latest, inflight, markOpen, refresh };
}

/**
 * content script の open / close に合わせてセッションを保つ。
 *
 * セッションは `open` を待たずに作る。待ってから描くと、iframe が表示された直後の打鍵が
 * まだ存在しない入力欄に届かず落ちる（mvp の罠と同じ形）。閉じている間も描いておき、
 * content script の `iframe.focus()` がそのまま入力欄のフォーカスになる
 */
export function usePaletteSession(channel: HostChannel) {
  const { session, latest, inflight, markOpen, refresh } = useSessionSupply();

  const close = useCallback(() => {
    markOpen(false);
    channel.send({ t: 'close' });
    void refresh();
  }, [channel, refresh, markOpen]);

  useEffect(() => {
    void refresh();
    return channel.subscribe((message) => {
      if (message.t === 'close') {
        markOpen(false);
        void refresh();
        return;
      }
      markOpen(true);
      /*
       * 用意済みなら同期で開く。await を挟むと、その間に打たれた文字が入力欄に入った後で
       * open が届き、状態のリセットで消える
       */
      if (latest.current !== null) {
        applyOpen(latest.current, close);
        return;
      }
      // 用意の途中に open が来ることもある。「まだ無い」を「スペースではない」と取り違えない
      void (async () => {
        const ready = (await inflight.current) ?? null;
        if (ready === null) channel.send({ t: 'close' });
        else applyOpen(ready, close);
      })();
    });
  }, [channel, refresh, close, latest, inflight, markOpen]);

  return { session, close };
}
