import { type RefCallback, useState } from 'react';

const noop = () => {};

export function useElementWidth(): [number | undefined, RefCallback<HTMLElement>] {
  const [width, setWidth] = useState<number>();
  const ref = (element: HTMLElement | null) => {
    if (element === null) return noop;
    const measure = () => setWidth(element.getBoundingClientRect().width);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  };
  return [width, ref];
}
