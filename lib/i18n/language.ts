import type { Settings } from '@/lib/storage/palette-items';

export type Language = 'ja' | 'en';

/** ブラウザの UI 言語に従い、設定で上書きできる（D-11、surfaces.md §9）。日本語以外はすべて英語 */
export function resolveLanguage(setting: Settings['language'], uiLanguage: string): Language {
  if (setting !== 'system') return setting;
  return uiLanguage.toLowerCase().startsWith('ja') ? 'ja' : 'en';
}
