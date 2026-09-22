import { type RefObject, useLayoutEffect, useState } from 'react';

/**
 * 下にまだ内容があるか。スクロール余地の有無ではなく「今より下が隠れているか」を返すので、
 * 最下部まで送ったら false に戻る
 */
export function useHasMoreBelow(ref: RefObject<HTMLElement | null>): boolean {
  const [hasMore, setHasMore] = useState(false);

  useLayoutEffect(() => {
    const element = ref.current;
    const update = () => {
      if (element === null) return;
      const { scrollTop, clientHeight, scrollHeight } = element;
      setHasMore(scrollTop + clientHeight < scrollHeight - 1);
    };
    const observer = new ResizeObserver(update);
    if (element !== null) {
      update();
      observer.observe(element);
      element.addEventListener('scroll', update, { passive: true });
    }
    return () => {
      observer.disconnect();
      element?.removeEventListener('scroll', update);
    };
  }, [ref]);

  return hasMore;
}
