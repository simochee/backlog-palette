import { en, ja, type Labels } from '@/components/labels';
import type { Settings } from '@/lib/storage/palette-items';

export type Language = 'ja' | 'en';

/** ブラウザの UI 言語に従い、設定で上書きできる（D-11、surfaces.md §9） */
export function resolveLanguage(setting: Settings['language'], uiLanguage: string): Language {
  if (setting !== 'system') return setting;
  return uiLanguage.toLowerCase().startsWith('ja') ? 'ja' : 'en';
}

export function labelsFor(language: Language): Labels {
  return language === 'ja' ? ja : en;
}
