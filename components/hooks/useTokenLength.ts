import { type RefObject, useLayoutEffect, useState } from 'react';

/** 要素に効いている --bp-* の長さトークンを px で読む。数値をコードに写さないための経路 */
export function useTokenLength(ref: RefObject<HTMLElement | null>, token: string): number | undefined {
  const [length, setLength] = useState<number>();

  useLayoutEffect(() => {
    const element = ref.current;
    if (element === null) return;
    const value = getComputedStyle(element).getPropertyValue(token).trim();
    const parsed = Number.parseFloat(value);
    setLength(Number.isNaN(parsed) ? undefined : parsed);
  }, [ref, token]);

  return length;
}
