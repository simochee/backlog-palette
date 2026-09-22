import { useCallback, useEffect, useRef, useState } from 'react';

import type { HostChannel } from '@/lib/messaging/hostChannel';
import { createPaletteStore, type PaletteStore } from '@/lib/palette';

import { type Pending, restartSearch } from './actions.ts';
import { applyBacklogColorScheme } from './colorScheme.ts';
import { createSession, type PaletteSession } from './createSession.ts';
import { handOffToPanel } from './panel.ts';
import { watchConnectedSpaces } from './spaces.ts';
import { paletteTelemetry } from './telemetry.ts';

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
    // 接続の保存は鍵と記録の 2 回の書き込みで、用意が重なる。遅れて終わった古い方で上書きしない
    if (inflight.current !== next) return ready;
    latest.current = ready ?? null;
    setSession(ready);
    return ready;
  }, []);

  return { session, latest, inflight, refresh };
}

function openWhenReady(
  latest: PaletteSession | null,
  inflight: Promise<PaletteSession | undefined> | null,
  open: (ready: PaletteSession | null) => void,
) {
  /*
   * 用意済みなら同期で開く。await を挟むと、その間に打たれた文字が入力欄に入った後で
   * open が届き、状態のリセットで消える
   */
  if (latest !== null) {
    open(latest);
    return;
  }
  // 用意の途中に open が来ることもある。「まだ無い」を「スペースではない」と取り違えない
  void inflight?.then((ready) => open(ready ?? null));
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
    /*
     * 用意は iframe の読み込み時と閉じた時にしか走らない。同じページの貼り付けバーで接続すると、
     * 次の ⌘K が接続前に用意した「未接続」の材料で開いてしまうため、接続の変化でも用意し直す
     */
    const unwatchConnections = watchConnectedSpaces(() => void refresh());
    const unsubscribe = channel.subscribe((message) => {
      if (message.t === 'close') {
        void refresh();
        return;
      }
      // 読み込み後に Backlog 側でテーマを切り替えていても、開くたびに追いつく
      applyBacklogColorScheme(message.ctx.colorScheme);
      setOpenedAt(Date.now());
      paletteTelemetry.opened();
      openWhenReady(latest.current, inflight.current, open);
    });
    return () => {
      unwatchConnections();
      unsubscribe();
    };
  }, [channel, refresh, close, store, pending, latest, inflight]);

  return { session, store, pending, openedAt, close };
}
