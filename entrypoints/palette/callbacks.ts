import { useCallback, useMemo } from 'react';

import type { PaletteCallbacks } from '@/components/organisms/Palette';
import type { DerivedPalette, PaletteStore } from '@/lib/palette';
import { activeCommand } from '@/lib/stack/stack';
import type { Stack } from '@/lib/stack/types';

import {
  type ActionEnv,
  cancelSearch,
  copySearchUrl,
  openPanel,
  type Pending,
  performAction,
} from './actions.ts';

type Input = {
  store: PaletteStore;
  derived: DerivedPalette;
  env: ActionEnv;
  pending: Pending;
  stack: Stack;
  close: () => void;
};

type RowCallbacks = Pick<PaletteCallbacks, 'onAction' | 'onTake'>;

/** 行 id → 動作の解決は derive が済ませている。ここは Map を引いて実行するだけ（I1 を container で破らない） */
function useRowCallbacks({ store, derived, env, pending }: Input): RowCallbacks {
  const onAction = useCallback(
    (id: string, opts: { newTab: boolean }) => {
      const action = derived.actions.get(id);
      if (action !== undefined) void performAction(action, opts.newTab, env, pending);
    },
    [derived.actions, env, pending],
  );
  const onTake = useCallback(
    (id: string) => {
      const target = derived.takes.get(id);
      if (target !== undefined) store.dispatch({ type: 'took', target });
    },
    [derived.takes, store],
  );
  return { onAction, onTake };
}

/** presenter のコールバックを Store のアクションと行の動作に写す */
export function usePaletteCallbacks(input: Input): PaletteCallbacks {
  const { store, env, pending, stack, close } = input;
  const rows = useRowCallbacks(input);

  const onInputChange = useCallback(
    (value: string) => {
      // 入力が変わったら走っている検索は捨てる（palette.md §7.4）
      cancelSearch(pending);
      store.dispatch({ type: 'inputChanged', value });
    },
    [store, pending],
  );

  const onEscape = useCallback(() => {
    // コマンド階層では 1 段戻る。スコープだけのときは閉じる（D-6）
    if (activeCommand(stack) === undefined) close();
    else store.dispatch({ type: 'escaped' });
  }, [stack, store, close]);

  return useMemo(
    () => ({
      ...rows,
      onInputChange,
      onEscape,
      onSelectionChange: (id: string) => store.dispatch({ type: 'selected', id }),
      onBackspaceAtStart: () => store.dispatch({ type: 'backspacedAtStart' }),
      onCopySearchUrl: () => void copySearchUrl(env, pending),
      onOpenPanel: () => void openPanel(env),
      onDismiss: close,
    }),
    [rows, onInputChange, onEscape, store, env, pending, close],
  );
}
