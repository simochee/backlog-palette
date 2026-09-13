import type { Labels } from '@/components/labels';
import type { SectionView } from '@/components/types';

import type { Built } from './rows';

/** セクションごとの上限（palette.md §4・§9） */
export const SECTION_CAP = 5;
/** 全体の上限。超えた分は切り、切ったセクションの補足に「他 N 件」を出す（`›` に化けさせない） */
export const TOTAL_CAP = 12;

export type BuiltSection = {
  id: string;
  label?: string;
  meta?: string;
  rows: readonly Built[];
  /** セクション自身の上限。無ければ全体の上限だけが効く */
  cap?: number;
  /** 全体の上限 12 に数えない。検索結果は 30 行まで出す（§7.3）ので候補の枠を食わない */
  uncapped?: boolean;
};

type Capped = { sections: SectionView[]; rows: Built[] };

function truncate(section: BuiltSection, room: number, labels: Labels): BuiltSection {
  const cap = Math.min(section.cap ?? Number.POSITIVE_INFINITY, room);
  if (section.rows.length <= cap) return section;
  const cut = section.rows.length - cap;
  const meta = [section.meta, labels.sections.more(cut)].filter((m) => m !== undefined).join(' · ');
  return { ...section, rows: section.rows.slice(0, cap), meta };
}

/** 上限で切って SectionView に写す。行の平坦な並びも返し、選択とキー解決に使う */
export function capSections(sections: readonly BuiltSection[], labels: Labels): Capped {
  const views: SectionView[] = [];
  const rows: Built[] = [];
  let room = TOTAL_CAP;
  for (const section of sections) {
    if (section.rows.length === 0) continue;
    const kept = section.uncapped === true ? section : truncate(section, room, labels);
    if (section.uncapped !== true) room -= kept.rows.length;
    rows.push(...kept.rows);
    views.push({
      id: kept.id,
      label: kept.label,
      meta: kept.meta,
      rows: kept.rows.map((built) => built.row),
    });
    if (room <= 0) break;
  }
  return { sections: views, rows };
}
