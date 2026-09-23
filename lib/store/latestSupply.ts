import { createStore } from '@tanstack/store';

import type { Readable } from './index';

/**
 * 非同期に作り直す値。作り直しは重なるので、最後に頼んだものだけを反映し、遅れて終わった
 * 古い方で上書きしない。
 *
 * 値を待つ受け手は 1 つだけ持つ。後から頼んだ受け手が前の受け手を置き換え、取り消した受け手には
 * 渡さない。受け手ごとに進行中の promise へ繋ぐと、取り消せず、どの作り直しの値が届くかも
 * 繋いだ時点の promise で決まってしまう
 */
export function createLatestSupply<T>(make: () => Promise<T>, initial: T) {
  const current = createStore<T>(initial);
  let inflight: Promise<T> | undefined;
  let settled = false;
  let waiting: ((value: T) => void) | undefined;

  const refresh = async (): Promise<void> => {
    const next = make();
    inflight = next;
    const ready = await next;
    if (inflight !== next) return;
    settled = true;
    current.setState(() => ready);
    const receive = waiting;
    waiting = undefined;
    receive?.(ready);
  };

  /*
   * 一度でも作り終えていれば、進行中の作り直しは待たず、直前の値で同期に渡す。
   * 待つのはまだ一度も作り終えていないときだけ
   */
  const deliver = (receive: (value: T) => void): void => {
    if (settled) receive(current.state);
    else waiting = receive;
  };

  const cancel = (): void => {
    waiting = undefined;
  };

  const readable: Readable<T> = current;
  return { current: readable, refresh, deliver, cancel };
}
