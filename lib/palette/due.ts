import type { Labels } from '@/components/labels';
import type { Badge } from '@/components/types';

const DAY = 24 * 60 * 60 * 1000;
/** これより先の期限は出さない。今日やることの判断に効かず、行の情報だけが増える */
const SOON_DAYS = 7;

/** `2026-09-25T00:00:00Z` も `2026-09-25` も受ける。時刻は持たないので日付だけを見る */
function startOfDay(value: string): number | undefined {
  const parsed = Date.parse(value.slice(0, 10));
  return Number.isNaN(parsed) ? undefined : parsed;
}

/**
 * 期限のバッジ（palette.md §5）。**期限切れと 7 日以内のときだけ**返す。
 * 並びは更新日時順のまま変えない（P6）ので、急ぎを見つける手がかりを行の側に置く。
 * すべての期限を出すと、担当課題 5 行のうち大半が意味を持たないバッジを抱える
 */
export function dueBadge(
  dueDate: string | undefined,
  now: number,
  labels: Labels,
): Badge | undefined {
  if (dueDate === undefined) return undefined;
  const due = startOfDay(dueDate);
  if (due === undefined) return undefined;

  const today = startOfDay(new Date(now).toISOString());
  if (today === undefined) return undefined;

  const days = Math.round((due - today) / DAY);
  const label = labels.rows.dueOn(new Date(due).getUTCMonth() + 1, new Date(due).getUTCDate());
  if (days < 0) return { label: labels.rows.overdue, tone: 'danger' };
  if (days <= SOON_DAYS) return { label, tone: 'warning' };
  return undefined;
}
