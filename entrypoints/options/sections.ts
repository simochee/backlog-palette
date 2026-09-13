/** 設定画面のセクション。並びは surfaces.md §2 の表のとおりで、1 つずつがルートになる */
export const SECTION_IDS = [
  'spaces',
  'display',
  'custom-domain',
  'learning',
  'history',
  'shortcuts',
  'telemetry',
  'about',
] as const;

export type SectionId = (typeof SECTION_IDS)[number];

export const DEFAULT_SECTION: SectionId = 'spaces';

export function isSectionId(value: string): value is SectionId {
  return (SECTION_IDS as readonly string[]).includes(value);
}
