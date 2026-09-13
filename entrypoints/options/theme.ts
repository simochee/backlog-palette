import { useEffect } from 'react';

import type { Settings } from '@/lib/storage/palette-items';

const DARK = '(prefers-color-scheme: dark)';

/*
 * palette.css は data-color-scheme の light / dark だけを見る。「システムに追従」は
 * 拡張ページ側が OS の設定を読んで属性に写す。CSS の prefers-color-scheme に任せると、
 * iframe の中など属性がルート以外に付く場面で light の再宣言に負ける（mvp の罠）。
 */
export function applyColorScheme(theme: Settings['theme'], prefersDark: boolean): void {
  const resolved = theme === 'system' ? (prefersDark ? 'dark' : 'light') : theme;
  document.documentElement.dataset.colorScheme = resolved;
}

export function useColorScheme(theme: Settings['theme']) {
  useEffect(() => {
    const media = window.matchMedia(DARK);
    const apply = () => applyColorScheme(theme, media.matches);
    apply();
    media.addEventListener('change', apply);
    return () => {
      media.removeEventListener('change', apply);
    };
  }, [theme]);
}
