import { useSelector } from '@tanstack/react-store';
import { type RefObject, useEffect, useMemo, useRef } from 'react';

import { LabelsProvider } from '@/components/labels';
import { Palette } from '@/components/organisms/Palette';
import { isPaletteHotkey } from '@/lib/hotkey/paletteHotkey';
import { detectPlatform } from '@/lib/keys';
import { derive, type PaletteStore } from '@/lib/palette';
import { scopeOf } from '@/lib/stack/stack';

import { type ActionEnv, type Pending, restartSearch } from './actions.ts';
import { usePaletteCallbacks } from './callbacks.ts';
import { hostChannel } from './hostChannel.ts';
import { OpeningSink } from './OpeningSink.tsx';
import { handOffToPanel } from './panel.ts';
import { type OpenSession, useOpenSession } from './session.ts';

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

/**
 * 共有 URL で開いたときに検索を復元する（palette.md §7.6）。条件つきの状態はサイドパネルへ渡し、
 * 開けない環境（Firefox）では語とスコープだけをパレットで復元する（surfaces.md §5.1・§5.5）
 */
function useRestoredSearch(session: OpenSession, pending: RefObject<Pending>, close: () => void) {
  const { restore, runner, store } = session;

  useEffect(() => {
    if (restore === undefined) return;
    const run = async () => {
      if (restore.toPanel && (await handOffToPanel(restore.state))) {
        close();
        return;
      }
      restartSearch(
        restore.query,
        restore.scope,
        { runner, dispatch: store.dispatch },
        pending.current,
      );
    };
    void run();
  }, [restore, runner, store, pending, close]);
}

function OpenPalette({ session, close }: { session: OpenSession; close: () => void }) {
  const { store, index, labels, context, runner } = session;
  const state = useSelector(store, (snapshot) => snapshot);
  const pending = useRef<Pending>({ search: undefined, lastSearch: undefined });
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
  useRestoredSearch(session, pending, close);
  const callbacks = usePaletteCallbacks({ store, derived, env, pending, stack: state.stack, close });

  return (
    <LabelsProvider labels={labels}>
      <Palette {...derived.view} {...callbacks} />
    </LabelsProvider>
  );
}

/**
 * パレットの container。Store を購読し derive の結果を presenter に渡す。状態を持つのは
 * ここと Store だけ（CLAUDE.md の層構成）。開くたびに OpenPalette を作り直し、前回の入力・
 * 選択・スクロールを持ち越さない（palette.md §3）
 */
export function PaletteApp() {
  const { phase, close, onTyped } = useOpenSession(hostChannel);
  useCloseOnHotkey(close);
  // 閉じている間も sink を置く。次に開いたとき、open が届く前の打鍵を受けるため
  if (phase?.kind !== 'open') return <OpeningSink onTyped={onTyped} onEscape={close} />;
  return <OpenPalette key={phase.session.openedAt} session={phase.session} close={close} />;
}
