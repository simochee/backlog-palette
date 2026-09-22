import type { Hotkey } from '@tanstack/hotkeys';

import type { Labels } from '@/components/labels';
import type { KeyHintId, RowKind, RowView } from '@/components/types';

/**
 * 状態から導いた、いま押せるキー（palette.md §6）。フッターはこの配列から描き、
 * ヒントの文言を手で書く経路を作らない（不変条件 I2）。
 */
export type KeyBinding = {
  id: KeyHintId;
  /** 照合に使う。表示に出さない同義キー（Ctrl+N / Ctrl+P）も含む */
  hotkeys: readonly Hotkey[];
  /** フッターに出すキー */
  display: readonly Hotkey[];
  label: string;
  /** 幅が足りないときの短い言い方（§6・D-44） */
  shortLabel?: string;
  /** 幅が足りないとき大きい方から落とす。↵ は必ず残る（§6） */
  priority: number;
};

export type KeyState = {
  /** 選択行。仕様どおり DOM 上で選択されている行、無ければ先頭行 */
  selected: RowView | undefined;
  rowCount: number;
  /** ⌫ で外せる右端の段の名前。外せる段が無ければ undefined（根） */
  popLabel: string | undefined;
  hasInput: boolean;
  /** 検索結果が出ている（⌘⇧C の対象がある） */
  hasResults: boolean;
  /** サイドパネルへ渡せるか。Firefox はサイドバーが開いているときだけ（surfaces.md §5.5） */
  panelAvailable: boolean;
};

/** §6 の優先順。小さいほど残る */
const priorities: Record<KeyHintId, number> = {
  enter: 0,
  move: 1,
  back: 2,
  take: 3,
  modEnter: 4,
  toPanel: 5,
  copyUrl: 6,
};

type BindingExtras = { display?: readonly Hotkey[]; shortLabel?: string };

function binding(
  id: KeyHintId,
  hotkeys: readonly Hotkey[],
  label: string,
  extras: BindingExtras = {},
): KeyBinding {
  return {
    id,
    hotkeys,
    display: extras.display ?? hotkeys,
    label,
    ...(extras.shortLabel === undefined ? {} : { shortLabel: extras.shortLabel }),
    priority: priorities[id],
  };
}

/** ↵ の文言は行による: 開く／検索／適用／接続（§6）。載っていない種別は「開く」 */
const enterLabelKeys: Partial<Record<RowKind, 'search' | 'connect' | 'apply'>> = {
  search: 'search',
  connect: 'connect',
  status: 'connect',
  command: 'apply',
  notice: 'apply',
};

/** 2 段階コマンドの ↵ は積んで引数の行を出す動作なので、種別に関わらず「開く」 */
function enterLabel(row: RowView, labels: Labels): string {
  if (row.hints.includes('descend')) return labels.keys.open;
  return labels.keys[enterLabelKeys[row.kind] ?? 'open'];
}

/** ⇥ は積む行・階層を開く行・補完する行で文言が変わる。取り込める行が無ければ出さない（I3 は presenter 側で止める） */
function takeLabel(row: RowView, labels: Labels): string | undefined {
  if (row.hints.includes('descend')) return labels.keys.descend;
  if (row.hints.includes('stack')) return labels.keys.stack;
  if (row.hints.includes('complete')) return labels.keys.complete;
  return undefined;
}

function rowBindings(row: RowView | undefined, labels: Labels): KeyBinding[] {
  if (row === undefined || row.hints.length === 0) return [];
  const bindings = [binding('enter', ['Enter'], enterLabel(row, labels))];
  const take = takeLabel(row, labels);
  if (take !== undefined) bindings.push(binding('take', ['Tab'], take));
  if (row.hints.includes('modEnter'))
    bindings.push(binding('modEnter', ['Mod+Enter'], labels.keys.newTab));
  return bindings;
}

export function deriveBindings(state: KeyState, labels: Labels): KeyBinding[] {
  const bindings = rowBindings(state.selected, labels);

  if (state.rowCount > 1)
    bindings.push(
      binding('move', ['ArrowUp', 'ArrowDown', 'Control+N', 'Control+P'], labels.keys.move, {
        display: ['ArrowUp', 'ArrowDown'],
      }),
    );
  // 削除待ちかどうかで文言を変えない。1 回目か 2 回目かはヘッダーの予告と取り消し線が言う（§8）
  if (state.popLabel !== undefined)
    bindings.push(
      binding('back', ['Backspace'], labels.keys.back(state.popLabel), {
        shortLabel: labels.keys.backShort,
      }),
    );
  if (state.hasInput && state.panelAvailable)
    bindings.push(binding('toPanel', ['Mod+ArrowRight'], labels.keys.toPanel));
  if (state.hasResults)
    bindings.push(
      binding('copyUrl', ['Mod+Shift+C'], labels.keys.copyUrl, {
        shortLabel: labels.keys.copyUrlShort,
      }),
    );

  return bindings.toSorted((a, b) => a.priority - b.priority);
}
