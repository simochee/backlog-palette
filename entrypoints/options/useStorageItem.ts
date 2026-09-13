import { useEffect, useState } from 'react';

import type { WxtStorageItem } from '#imports';

/**
 * defineItem を購読する。設定画面は保存ボタンを持たず各行がその場で書き戻すので、
 * 他の拡張ページ（パレット・接続シート）が書いた値も watch で追う。
 * 読み込み前は undefined で、呼び出し側が「まだ分からない」と「空」を区別できるようにする。
 */
export function useStorageItem<T>(item: WxtStorageItem<T, Record<string, unknown>>): T | undefined {
  const [value, setValue] = useState<T>();
  useEffect(() => {
    let alive = true;
    void (async () => {
      const stored = await item.getValue();
      if (alive) setValue(stored);
    })();
    const unwatch = item.watch((next) => {
      setValue(next);
    });
    return () => {
      alive = false;
      unwatch();
    };
  }, [item]);
  return value;
}
