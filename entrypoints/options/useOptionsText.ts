import { en, ja, type Labels } from '@/components/labels';
import type { Settings } from '@/lib/storage/palette-items';

import { type OptionsText, optionsText, resolveLocale } from './text.ts';

export type ResolvedText = {
  labels: Labels;
  text: OptionsText;
  customDomain: { title: string; description: string };
};

/** 部品の辞書（labels）と container の文言（text）を同じ言語で揃える（surfaces.md §9） */
export function resolveOptionsText(language: Settings['language']): ResolvedText {
  const locale = resolveLocale(language, navigator.language);
  const labels = locale === 'en' ? en : ja;
  const { title, description } = labels.options.customDomain;
  return { labels, text: optionsText[locale], customDomain: { title, description } };
}
