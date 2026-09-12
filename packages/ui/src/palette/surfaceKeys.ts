import type { KeyboardEvent } from 'react';

/** 入力欄のキャレット。⌫ をスタックと入力文字列のどちらに効かせるかの材料 */
export type Caret = { start: number; end: number };

export type SurfaceKeyHandlerOptions = {
  /** キャレット位置を見るための入力欄 */
  getInput: () => HTMLInputElement | null;
  /** 候補リストを含む要素。省略時はハンドラを付けた要素から探す */
  getListRoot?: (event: KeyboardEvent<HTMLElement>) => Element | null | undefined;
  onAction?: (id: string) => void;
  onEscape?: () => void;
  /** ⌫。キャレットの位置を渡す。スタックに効かせるかは呼び出し側が決める */
  onStackBackspace?: (caret: Caret) => void;
};

/**
 * 入力欄と候補リストを持つサーフェス共通のキー処理。モーダルとサイドパネルで
 * 同じ規則を使う。キャプチャ段階に置く前提で書かれている。
 */
export function createSurfaceKeyHandler({
  getInput,
  getListRoot,
  onAction,
  onEscape,
  onStackBackspace,
}: SurfaceKeyHandlerOptions) {
  return (event: KeyboardEvent<HTMLElement>) => {
    /**
     * 変換中のキーはリストに届かせない。
     *
     * React Aria は isComposing を見ないため、これが無いと変換確定の Enter で
     * 遷移が発火し、↑↓ での IME 候補選択がリストの選択移動と二重に動く（P4）。
     * キャプチャ段階で止めるので、Autocomplete の内部ハンドラより先に効く。
     */
    if (event.nativeEvent.isComposing) {
      event.stopPropagation();
      return;
    }

    /*
     * Enter の宛先は自分で決める。
     *
     * React Aria は候補が入れ替わっても仮想フォーカスを持ち越すため、
     * aria-activedescendant が消えた行を指したまま残ることがある
     * （`PROJ-12` まで打った時点の行を、`PROJ-123` の候補が出た後も指す）。
     * その状態で Enter を押すと宛先が存在せず、何も起きない。行は selected の
     * 見た目なので、いちばん分かりにくい壊れ方になる。
     *
     * 実在するフォーカス行、無ければ先頭行、という規則にすれば
     * 「見えている選択と Enter の宛先は必ず一致する」を保証できる。
     */
    if (event.key === 'Enter' && onAction) {
      const root = getListRoot?.(event) ?? event.currentTarget;
      const list = root?.querySelector('[role="listbox"]');
      const focused = list?.querySelector('[role="option"][data-focused]');
      const target = focused ?? list?.querySelector('[role="option"]');
      const key = target?.getAttribute('data-key');

      if (key !== null && key !== undefined) {
        event.preventDefault();
        event.stopPropagation();
        onAction(key);
        return;
      }
    }

    /*
     * Esc は React Aria が入力欄のクリアに使うため、先に奪う。
     * 「Esc で 1 階層戻る / 閉じる」は覚えるキーを増やさないための規則
     * （§3 D3）で、入力欄のクリアに消費されると階層から出られなくなる。
     */
    if (event.key === 'Escape' && onEscape) {
      event.preventDefault();
      event.stopPropagation();
      onEscape();
      return;
    }

    /*
     * ⌫ は入力欄に任せるか、スタックに回すかが分かれる唯一のキー。
     * 分岐の規則そのものは呼び出し側が持つので、ここはキャレットを渡し、
     * 入力欄の 1 文字削除を止めるかどうかだけを決める。
     */
    if (event.key === 'Backspace' && onStackBackspace) {
      const input = getInput();
      const caret = { start: input?.selectionStart ?? 0, end: input?.selectionEnd ?? 0 };
      if (caret.start === 0 && caret.end === 0) {
        event.preventDefault();
        event.stopPropagation();
      }
      onStackBackspace(caret);
    }
  };
}
