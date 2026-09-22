import { useSelector } from '@tanstack/react-store';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { LabelsProvider } from '@/components/labels';
import { Palette } from '@/components/organisms/Palette';
import { isPaletteHotkey } from '@/lib/hotkey/paletteHotkey';
import { detectPlatform } from '@/lib/keys';
import { type AssignedState, derive, type PaletteIndex, type PaletteStore } from '@/lib/palette';
import { endedOffline } from '@/lib/search';
import { scopeOf } from '@/lib/stack/stack';

import { type ActionEnv, type Pending, restartSearch } from './actions.ts';
import { usePaletteCallbacks } from './callbacks.ts';
import type { PaletteSession } from './createSession.ts';
import { hostChannel } from './hostChannel.ts';
import { usePaletteSession } from './session.ts';

const TOAST_LIFETIME_MS = 2000;

/** Firefox はサイドバーをスクリプトから開けない。開いているときだけ出す判定は M6（surfaces.md §5.5） */
const PANEL_AVAILABLE = import.meta.env.BROWSER !== 'firefox';

function useCloseOnHotkey(close: () => void) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // 開いているときの ⌘K は閉じる（D-8）。iframe にフォーカスがあると content script には届かない
      if (event.isComposing || !isPaletteHotkey(event, navigator.platform)) return;
      event.preventDefault();
      close();
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true });
    };
  }, [close]);
}

/** トーストの寿命は 2 秒（palette.md §11）。次のキー入力で消えるのは reducer 側 */
function useToastExpiry(store: PaletteStore, toast: unknown) {
  useEffect(() => {
    const timer =
      toast === undefined
        ? undefined
        : setTimeout(() => store.dispatch({ type: 'toastExpired' }), TOAST_LIFETIME_MS);
    return () => {
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [store, toast]);
}

/*
 * 閉じている間も描き続けるので（PaletteApp の注記）、開閉を見ないと閉じたパレットが
 * 接続の回復で API を叩く。Backlog のタブの数だけ iframe があるので、その数だけ走る
 */
function useRetryWhenOnline(offline: boolean, retry: () => void) {
  useEffect(() => {
    if (!offline) return;
    window.addEventListener('online', retry);
    return () => {
      window.removeEventListener('online', retry);
    };
  }, [offline, retry]);
}

/** 担当課題は届いた時点で索引に足す。届くまでは表示キャッシュだけで描く（palette.md §9） */
function useIndexWithAssigned(session: PaletteSession): PaletteIndex {
  const [assigned, setAssigned] = useState<AssignedState>();
  useEffect(() => {
    let alive = true;
    const receive = async () => {
      const state = await session.assigned;
      if (alive) setAssigned(state);
    };
    void receive();
    return () => {
      alive = false;
    };
  }, [session]);
  return useMemo(
    () => (assigned === undefined ? session.index : { ...session.index, assigned }),
    [session.index, assigned],
  );
}

type OpenPaletteProps = {
  session: PaletteSession;
  store: PaletteStore;
  pending: Pending;
  open: boolean;
  openedAt: number;
  close: () => void;
};

function OpenPalette({ session, store, pending, open, openedAt, close }: OpenPaletteProps) {
  const { labels, context, runner } = session;
  const index = useIndexWithAssigned(session);
  const state = useSelector(store, (snapshot) => snapshot);
  useToastExpiry(store, state.toast);

  const derived = useMemo(
    () =>
      derive(state, index, labels, { platform: detectPlatform(), panelAvailable: PANEL_AVAILABLE }),
    [state, index, labels],
  );
  const env = useMemo<ActionEnv>(
    () => ({
      context,
      labels,
      learningEnabled: index.learningEnabled,
      runner,
      query: state.input.trim(),
      scope: scopeOf(state.stack),
      dispatch: store.dispatch,
      close,
      now: Date.now,
    }),
    [context, labels, index.learningEnabled, runner, state.input, state.stack, store, close],
  );
  // オフラインで終わった検索は、接続が戻ったら同じ語とスコープで引き直す（palette.md §7.5、D-58）
  const retry = useCallback(() => {
    const last = pending.lastSearch;
    if (last !== undefined) restartSearch(last.query, last.scope, env, pending, 'reconnect');
  }, [pending, env]);
  useRetryWhenOnline(open && endedOffline(state.session), retry);
  const callbacks = usePaletteCallbacks({
    store,
    derived,
    env,
    pending,
    stack: state.stack,
    close,
  });

  return (
    <LabelsProvider labels={labels}>
      <Palette {...derived.view} {...callbacks} focusToken={openedAt} />
    </LabelsProvider>
  );
}

/**
 * パレットの container。Store を購読し derive の結果を presenter に渡す。状態を持つのは
 * ここと Store だけ（CLAUDE.md の層構成）。
 *
 * 表示・非表示は content script が iframe ごと切り替えるので、ここは閉じている間も描き続ける。
 * `open` を待ってから描くと、iframe が表示された直後の打鍵が入力欄に届かない
 */
export function PaletteApp() {
  const { session, store, pending, open, openedAt, close } = usePaletteSession(hostChannel);
  useCloseOnHotkey(close);
  if (session === undefined) return null;
  return (
    <OpenPalette
      session={session}
      store={store}
      pending={pending}
      open={open}
      openedAt={openedAt}
      close={close}
    />
  );
}
