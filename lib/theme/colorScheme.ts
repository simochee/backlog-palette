import type { Settings } from '@/lib/storage/palette-items';

export type ColorScheme = 'light' | 'dark';

/*
 * palette.css は data-color-scheme の light / dark だけを見る。「システムに追従」は
 * 拡張ページ側が OS の設定を読んで属性に写す。CSS の prefers-color-scheme に任せると、
 * iframe の中など属性がルート以外に付く場面で light の再宣言に負ける（mvp の罠）。
 */
export function resolveColorScheme(theme: Settings['theme'], prefersDark: boolean): ColorScheme {
  if (theme === 'system') return prefersDark ? 'dark' : 'light';
  return theme;
}

export function applyColorScheme(
  root: HTMLElement,
  theme: Settings['theme'],
  prefersDark: boolean,
) {
  root.dataset.colorScheme = resolveColorScheme(theme, prefersDark);
}
