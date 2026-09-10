import { useLayoutEffect, useState } from 'react';

export type PanelLayout = 'narrow' | 'medium' | 'wide';

const NARROW_MAX = 480;
const MEDIUM_MAX = 860;

export function layoutForWidth(width: number): PanelLayout {
  if (width < NARROW_MAX) return 'narrow';
  if (width <= MEDIUM_MAX) return 'medium';
  return 'wide';
}

/**
 * レイアウトの切替はウィンドウ幅ではなくコンテナ幅で決める（§5.3）。
 *
 * 同じサーフェスをサイドパネルと別タブの両方で出すので、window.innerWidth は
 * 当てにならない。CSS のコンテナクエリでは足りない。プレビューを右ペインに置くか
 * 行の中に展開するか、種別をタブで出すか見出しで出すかは要素の構造そのものが
 * 変わるので、幅を JS 側でも知っている必要がある。
 */
export function usePanelLayout(element: HTMLElement | null): PanelLayout {
  const [layout, setLayout] = useState<PanelLayout>('medium');

  useLayoutEffect(() => {
    if (element === null) return;

    // ResizeObserver の初回コールバックは描画の後なので、最初の 1 回はここで測る
    setLayout(layoutForWidth(element.clientWidth));

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setLayout(layoutForWidth(entry.contentRect.width));
      }
    });
    observer.observe(element);

    return () => observer.disconnect();
  }, [element]);

  return layout;
}
