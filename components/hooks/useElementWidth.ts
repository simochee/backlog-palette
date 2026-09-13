import { type RefObject, useLayoutEffect, useState } from 'react';

export function useElementWidth(ref: RefObject<HTMLElement | null>): number | undefined {
  const [width, setWidth] = useState<number>();

  useLayoutEffect(() => {
    const element = ref.current;
    const observer = new ResizeObserver(() => {
      if (element !== null) setWidth(element.getBoundingClientRect().width);
    });
    if (element !== null) {
      setWidth(element.getBoundingClientRect().width);
      observer.observe(element);
    }
    return () => observer.disconnect();
  }, [ref]);

  return width;
}
