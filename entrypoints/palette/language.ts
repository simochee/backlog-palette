import { en, ja, type Labels } from '@/components/labels';
import type { Language } from '@/lib/i18n/language';

export function labelsFor(language: Language): Labels {
  return language === 'ja' ? ja : en;
}
