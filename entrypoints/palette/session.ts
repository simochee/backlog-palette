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

  return {
    context,
    index,
    labels: labelsFor(language),
    stack: initialStackOf(context, connected.get(context.spaceHost)),
    restore: restoreFrom(context.href, context.spaceHost),
    runner: emptySearchRunner,
  };
}

type OpenArgs = {
  session: PaletteSession;
  store: PaletteStore;
  pending: Pending;
  close: () => void;
};

/*
 * 開くたびに状態を開いた形へ戻す。前回の入力・選択・検索は残さない（palette.md §3）。
 * 共有 URL で開いたときはここで復元する。条件つきはサイドパネルへ渡し、開けない環境
 * （Firefox）では語とスコープだけパレットで復元する（surfaces.md §5.1・§5.5）
 */
function applyOpen({ session, store, pending, close }: OpenArgs): void {
  store.dispatch({ type: 'opened', stack: session.stack });
  const { restore } = session;
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
      pending,
    );
  })();
}

/** 用意した材料の保持。用意は非同期なので、進行中のものと最新のものを ref で持つ */
function useSessionSupply() {
  const [session, setSession] = useState<PaletteSession>();
  const latest = useRef<PaletteSession | null>(null);
  const inflight = useRef<Promise<PaletteSession | undefined> | null>(null);

  const refresh = useCallback(async () => {
    const next = createSession();
    inflight.current = next;
    const ready = await next;
    latest.current = ready ?? null;
    setSession(ready);
    return ready;
  }, []);

  return { session, latest, inflight, refresh };
}

/**
 * content script の open / close に合わせて、パレットの材料を用意し続ける。
 *
 * 材料は `open` を待たずに作る。待ってから描くと、iframe が表示された直後の打鍵が
 * まだ存在しない入力欄に届かず落ちる（mvp の罠と同じ形）。閉じている間も描いておき、
 * content script の `iframe.focus()` がそのまま入力欄のフォーカスになる
 */
export function usePaletteSession(channel: HostChannel) {
  const [store] = useState(createPaletteStore);
  const [pending] = useState<Pending>(() => ({ search: undefined, lastSearch: undefined }));
  /** 開いた時刻。presenter が入力欄へフォーカスを戻す合図に使う */
  const [openedAt, setOpenedAt] = useState(0);
  const { session, latest, inflight, refresh } = useSessionSupply();

  const close = useCallback(() => {
    channel.send({ t: 'close' });
    void refresh();
  }, [channel, refresh]);

  useEffect(() => {
    const open = (ready: PaletteSession | null) => {
      if (ready === null) channel.send({ t: 'close' });
      else applyOpen({ session: ready, store, pending, close });
    };

    void refresh();
    return channel.subscribe((message) => {
      if (message.t === 'close') {
        void refresh();
        return;
      }
      setOpenedAt(Date.now());
      /*
       * 用意済みなら同期で開く。await を挟むと、その間に打たれた文字が入力欄に入った後で
       * open が届き、状態のリセットで消える
       */
      if (latest.current !== null) {
        open(latest.current);
        return;
      }
      // 用意の途中に open が来ることもある。「まだ無い」を「スペースではない」と取り違えない
      void inflight.current?.then((ready) => open(ready ?? null));
    });
  }, [channel, refresh, close, store, pending, latest, inflight]);

  return { session, store, pending, openedAt, close };
}
