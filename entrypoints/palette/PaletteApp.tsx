import { useSelector } from '@tanstack/react-store';
import { createStore } from '@tanstack/store';
import { useEffect, useEffectEvent } from 'react';

import { LabelsProvider } from '@/components/labels';
import { Palette } from '@/components/organisms/Palette';
import type { AssignedState, PaletteStore } from '@/lib/palette';
import { endedOffline } from '@/lib/search';

import { restartSearch } from './actions.ts';
import type { PaletteController } from './controller.ts';
import { preparingSurface, readySurface } from './surface.ts';

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

/** 材料が届く前に useSelector へ渡す Store。材料の有無で hooks の呼び出しを変えられない */
const notSupplied = createStore<AssignedState>({ kind: 'loading' });

/**
 * パレットの container。Store を購読し derive の結果を presenter に渡す。状態を持つのは
 * controller と Store だけ（CLAUDE.md の層構成）。
 *
 * 表示・非表示は content script が iframe ごと切り替えるので、ここは閉じている間も描き続ける。
 * `open` を待ってから描くと、iframe が表示された直後の打鍵が入力欄に届かない
 */
export function PaletteApp({ controller }: { controller: PaletteController }) {
  const { store, pending, attachPalette } = controller;
  /*
   * 最初の材料を use() + Suspense で待たない。Suspense は fallback から中身へ切り替えるとき
   * 表示をまとめて遅らせ（最大 300ms）、その間は入力欄が無いので開いた直後の打鍵が落ちる。
   * Store の更新なら材料が届いた時点で同期に描ける
   */
  const session = useSelector(controller.session);
  const { open, panelAvailable } = useSelector(controller.surface);
  const state = useSelector(store);
  const assigned = useSelector(session?.assigned ?? notSupplied);
  useToastExpiry(store, state.toast);

  const ready =
    session === null
      ? undefined
      : readySurface({ session, controller, state, assigned, panelAvailable });
  // オフラインで終わった検索は、接続が戻ったら同じ語とスコープで引き直す（palette.md §7.5、D-59）
  useRetryWhenOnline(open && endedOffline(state.session), () => {
    const last = pending.lastSearch;
    if (ready !== undefined && last !== undefined)
      restartSearch(last.query, last.scope, ready.env, pending, 'reconnect');
  });
  /*
   * 材料の有無で描き分けるコンポーネントを分けない。型が変わると React は Palette ごと
   * 作り直し、材料が届いた瞬間に入力欄のフォーカスと変換中の文字が失われる
   */
  const { labels, view, callbacks } = ready?.surface ?? preparingSurface(state, controller);

  return (
    <LabelsProvider labels={labels}>
      <Palette {...view} {...callbacks} ref={attachPalette} />
    </LabelsProvider>
  );
}
