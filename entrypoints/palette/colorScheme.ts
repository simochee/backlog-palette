import { colorSchemeFrom } from '@/lib/theme/colorScheme';

/*
 * 利用者の設定（settings.theme）は見ない。パレットは Backlog の画面の上に重なるので、
 * 本体とテーマが食い違うと浮いて見える（D-57）
 */
export function applyBacklogColorScheme(value: unknown) {
  document.documentElement.dataset.colorScheme = colorSchemeFrom(value);
}
