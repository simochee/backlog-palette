import type { PaletteCallbacks } from '@/components/organisms/Palette';
import type { DerivedPalette, PaletteStore } from '@/lib/palette';
import { EXTERNAL_ROW_ID, MORE_EXTERNAL_ROW_ID } from '@/lib/search/ids';
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
import { paletteTelemetry, track } from './telemetry.ts';

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
function rowCallbacks({ store, derived, env, pending }: Input): RowCallbacks {
  const onAction = (id: string, opts: { newTab: boolean }) => {
    const action = derived.actions.get(id);
    if (action === undefined) return;
    if (id === EXTERNAL_ROW_ID || id === MORE_EXTERNAL_ROW_ID)
      track({ type: 'externalSearchOpened' });
    void performAction(action, opts.newTab, env, pending);
  };
  const onTake = (id: string) => {
    const target = derived.takes.get(id);
    if (target !== undefined) store.dispatch({ type: 'took', target });
  };
  return { onAction, onTake };
}

/** presenter のコールバックを Store のアクションと行の動作に写す */
export function paletteCallbacks(input: Input): PaletteCallbacks {
  const { store, env, pending, stack, close } = input;
  const rows = rowCallbacks(input);

  return {
    ...rows,
    onInputChange: (value) => {
      // 入力が変わったら走っている検索は捨てる（palette.md §7.4）
      cancelSearch(pending);
      paletteTelemetry.typed();
      store.dispatch({ type: 'inputChanged', value });
    },
    onEscape: () => {
      // コマンド階層では 1 段戻る。スコープだけのときは閉じる（D-6）
      if (activeCommand(stack) === undefined) close();
      else store.dispatch({ type: 'escaped' });
    },
    onSelectionChange: (id) => store.dispatch({ type: 'selected', id }),
    onBackspaceAtStart: () => store.dispatch({ type: 'backspacedAtStart' }),
    onCopySearchUrl: () => void copySearchUrl(env, pending),
    onOpenPanel: () => void openPanel(env),
    onDismiss: close,
  };
}
