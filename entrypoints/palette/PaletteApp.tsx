import { useSelector } from '@tanstack/react-store';
import { useEffect, useEffectEvent } from 'react';

import { LabelsProvider } from '@/components/labels';
import { Palette } from '@/components/organisms/Palette';
import { detectPlatform } from '@/lib/keys';
import { derive, type PaletteStore } from '@/lib/palette';
import { endedOffline } from '@/lib/search';
import { scopeOf } from '@/lib/stack/stack';

import { type ActionEnv, restartSearch } from './actions.ts';
import { paletteCallbacks } from './callbacks.ts';
import type { PaletteController } from './controller.ts';
import type { PaletteSession } from './createSession.ts';

const TOAST_LIFETIME_MS = 2000;
const noop = () => {};

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
  const onOnline = useEffectEvent(retry);
  useEffect(() => {
    if (!offline) return noop;
    const listener = () => onOnline();
    window.addEventListener('online', listener);
    return () => {
      window.removeEventListener('online', listener);
    };
  }, [offline]);
}

type OpenPaletteProps = { session: PaletteSession; controller: PaletteController };

function OpenPalette({ session, controller }: OpenPaletteProps) {
  const { store, pending, close } = controller;
  const { labels, context, runner } = session;
  const { open, openedAt, panelAvailable } = useSelector(controller.surface);
  const state = useSelector(store);
  // 担当課題は届いた時点で索引に足す。届くまでは表示キャッシュだけで描く（palette.md §9）
  const index = { ...session.index, assigned: useSelector(session.assigned) };
  useToastExpiry(store, state.toast);

  const derived = derive(state, index, labels, { platform: detectPlatform(), panelAvailable });
  const env: ActionEnv = {
    context,
    labels,
    learningEnabled: index.learningEnabled,
    runner,
    query: state.input.trim(),
    scope: scopeOf(state.stack),
    dispatch: store.dispatch,
    close,
    now: Date.now,
  };
  // オフラインで終わった検索は、接続が戻ったら同じ語とスコープで引き直す（palette.md §7.5、D-59）
  useRetryWhenOnline(open && endedOffline(state.session), () => {
    const last = pending.lastSearch;
    if (last !== undefined) restartSearch(last.query, last.scope, env, pending, 'reconnect');
  });
  const callbacks = paletteCallbacks({ store, derived, env, pending, stack: state.stack, close });

  return (
    <LabelsProvider labels={labels}>
      <Palette {...derived.view} {...callbacks} focusToken={openedAt} />
    </LabelsProvider>
  );
}

/**
 * パレットの container。Store を購読し derive の結果を presenter に渡す。状態を持つのは
 * controller と Store だけ（CLAUDE.md の層構成）。
 *
 * 表示・非表示は content script が iframe ごと切り替えるので、ここは閉じている間も描き続ける。
 * `open` を待ってから描くと、iframe が表示された直後の打鍵が入力欄に届かない
 */
export function PaletteApp({ controller }: { controller: PaletteController }) {
  /*
   * 最初の材料を use() + Suspense で待たない。Suspense は fallback から中身へ切り替えるとき
   * 表示をまとめて遅らせ（最大 300ms）、その間は入力欄が無いので開いた直後の打鍵が落ちる。
   * Store の更新なら材料が届いた時点で同期に描ける
   */
  const session = useSelector(controller.session);
  if (session === null) return null;
  return <OpenPalette session={session} controller={controller} />;
}
