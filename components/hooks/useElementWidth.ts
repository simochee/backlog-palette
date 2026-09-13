import { type RefObject, useLayoutEffect, useState } from 'react';

export function useElementWidth(ref: RefObject<HTMLElement | null>): number | undefined {
  const [width, setWidth] = useState<number>();

  useLayoutEffect(() => {
    const element = ref.current;
    if (element === null) return undefined;

    const measure = () => setWidth(element.getBoundingClientRect().width);
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return width;
}
