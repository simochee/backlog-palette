import { en } from './en';
import { ja } from './ja';
import type { Labels } from './types';

export type LabelsLanguage = 'ja' | 'en';

/** 言語 → 辞書。4 つの面（パレット・サイドパネル・接続バー・設定）が同じ写像を使う（surfaces.md §9） */
export function labelsFor(language: LabelsLanguage): Labels {
  return language === 'ja' ? ja : en;
}
