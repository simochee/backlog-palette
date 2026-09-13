import { useSelector } from '@tanstack/react-store';
import { useEffect, useMemo, useState } from 'react';

import { LabelsProvider } from '@/components/labels';
import { Palette } from '@/components/organisms/Palette';
import { isPaletteHotkey } from '@/lib/hotkey/paletteHotkey';
import { detectPlatform } from '@/lib/keys';
import { type CachedEntry, derive, type PaletteIndex, type PaletteStore } from '@/lib/palette';
import { scopeOf } from '@/lib/stack/stack';

import type { ActionEnv } from './actions.ts';
import { usePaletteCallbacks } from './callbacks.ts';
import { hostChannel } from './hostChannel.ts';
import { type PaletteSession, usePaletteSession } from './session.ts';

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

/** 担当課題は届いた時点で索引に足す。届くまでは表示キャッシュだけで描く（palette.md §9） */
function useIndexWithAssigned(session: PaletteSession): PaletteIndex {
  const [assigned, setAssigned] = useState<readonly CachedEntry[]>();
  useEffect(() => {
    let alive = true;
    const receive = async () => {
      const rows = await session.assigned;
      if (alive) setAssigned(rows);
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

function OpenPalette({ session, close }: { session: PaletteSession; close: () => void }) {
  const { store, labels, context, runner, pending } = session;
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
  const callbacks = usePaletteCallbacks({ store, derived, env, pending, stack: state.stack, close });

  return (
    <LabelsProvider labels={labels}>
      <Palette {...derived.view} {...callbacks} />
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
  const { session, close } = usePaletteSession(hostChannel);
  useCloseOnHotkey(close);
  if (session === undefined) return null;
  return <OpenPalette session={session} close={close} />;
}
