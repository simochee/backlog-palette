import { type RefCallback, useState } from 'react';

const noop = () => {};

/**
 * 下にまだ内容があるか。スクロール余地の有無ではなく「今より下が隠れているか」を返すので、
 * 最下部まで送ったら false に戻る
 */
export function useHasMoreBelow(): [boolean, RefCallback<HTMLElement>] {
  const [hasMore, setHasMore] = useState(false);
  const ref = (element: HTMLElement | null) => {
    if (element === null) return noop;
    const update = () => {
      const { scrollTop, clientHeight, scrollHeight } = element;
      setHasMore(scrollTop + clientHeight < scrollHeight - 1);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    element.addEventListener('scroll', update, { passive: true });
    return () => {
      observer.disconnect();
      element.removeEventListener('scroll', update);
    };
  };
  return [hasMore, ref];
}
