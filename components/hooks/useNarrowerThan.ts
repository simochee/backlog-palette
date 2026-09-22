import { type RefCallback, useState } from 'react';

const noop = () => {};

/** 要素に効いている --bp-* の長さトークンを px で読む。数値をコードに写さないための経路 */
function tokenLength(element: HTMLElement, token: string): number | undefined {
  const value = getComputedStyle(element).getPropertyValue(token).trim();
  const parsed = Number(value.replace(/px$/u, ''));
  return value === '' || Number.isNaN(parsed) ? undefined : parsed;
}

/** 要素の幅が長さトークンより狭いか。トークンが読めなければ狭くないとみなす */
export function useNarrowerThan(token: string): [boolean, RefCallback<HTMLElement>] {
  const [narrower, setNarrower] = useState(false);
  const ref = (element: HTMLElement | null) => {
    const threshold = element === null ? undefined : tokenLength(element, token);
    if (element === null || threshold === undefined) return noop;
    const measure = () => setNarrower(element.getBoundingClientRect().width < threshold);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  };
  return [narrower, ref];
}
