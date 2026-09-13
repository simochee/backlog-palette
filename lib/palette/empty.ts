import type { Labels } from '@/components/labels';
import { frecencyByEntity } from '@/lib/rank/frecency';
import { transitionScores } from '@/lib/rank/transitions';
import type { Scope } from '@/lib/stack/types';

import { entityId, type PaletteIndex, type SpaceEntry } from './model';
import { type Built, connectRow, entityRow, hintRow, pageRow, projectRow, spaceRow } from './rows';
import { type BuiltSection, SECTION_CAP } from './sections';

type Env = { index: PaletteIndex; scope: Scope; labels: Labels };

function spaceOf(index: PaletteIndex, spaceId: string): SpaceEntry | undefined {
  return index.spaces.find((space) => space.id === spaceId);
}

/**
 * 最近開いた: 課題・Wiki・ドキュメント・プロジェクトを 表示キャッシュ + 行動ログ から、頻度 × 直近性の順（§9）。
 * ページ定義は入れない。ページは次のセクションが遷移パターンで並べる担当で、同じページを 2 度出さない
 */
/** スコープのスペースの中だけ（D-20・D-27）。根では最近開いたを出さないので、絞れないケースは無い */
function inScope(scope: Scope, spaceId: string): boolean {
  return scope.kind !== 'root' && scope.spaceId === spaceId;
}

function recentSection({ index, scope, labels }: Env): BuiltSection {
  const scores = frecencyByEntity(index.activity, index.now);
  const sub = (context: string) => `${context} · ${labels.rows.recentSub}`;
  const rows: { built: Built; score: number }[] = [];

  for (const entry of index.cache) {
    if (!inScope(scope, entry.spaceId)) continue;
    const score = scores.get(entityId(entry.kind, entry.id));
    if (score !== undefined)
      rows.push({ built: entityRow('recent', entry, labels, sub(entry.projectName)), score });
  }
  for (const project of index.projects) {
    if (!inScope(scope, project.spaceId)) continue;
    const score = scores.get(entityId('project', project.id));
    const space = spaceOf(index, project.spaceId);
    if (score !== undefined && space !== undefined)
      rows.push({
        built: projectRow(
          'recent',
          project,
          space,
          labels,
          sub(labels.rows.projectSub(project.key)),
        ),
        score,
      });
  }

  return {
    id: 'recent',
    label: labels.sections.recent,
    meta: index.learningEnabled ? labels.sections.learned : undefined,
    rows: rows.toSorted((a, b) => b.score - a.score).map((r) => r.built),
    cap: SECTION_CAP,
  };
}

/** {現在の文脈} のページ。遷移パターンはこのセクション内の並びにだけ効く（D-16） */
function pagesSection({ index, scope, labels }: Env, scopeLabel: string): BuiltSection {
  const pages = index.pagesFor(scope);
  const from = index.currentPageKind;
  const scores =
    from === undefined
      ? new Map<string, number>()
      : transitionScores(index.transitions, from, index.now);
  const ordered = pages
    .map((page, order) => ({ page, order, score: scores.get(page.id) ?? 0 }))
    .toSorted((a, b) => b.score - a.score || a.order - b.order);
  const sub = `${scopeLabel} · ${labels.rows.pageSub}`;
  return {
    id: 'pages',
    label: labels.sections.pagesOf(scopeLabel),
    rows: ordered.map(({ page }) => pageRow('pages', page, sub)),
    cap: SECTION_CAP,
  };
}

function assignedSection({ index, labels }: Env): BuiltSection {
  const assigned = index.assigned ?? [];
  return {
    id: 'assigned',
    label: labels.sections.assigned,
    meta: index.assigned === undefined ? undefined : labels.sections.count(assigned.length),
    rows: assigned.map((entry) => entityRow('assigned', entry, labels)),
    cap: SECTION_CAP,
  };
}

/**
 * 空状態（§9）。表示キャッシュだけで即描画し、担当課題は届いた分だけ末尾に足す。
 * 未接続のスペースでも「最近開いた」は表示キャッシュと行動ログだけで出せる。API が要るのは
 * 担当課題だけなので、それを除いた [recent, pages] の下に接続行を 1 つ。何も無ければ接続行だけ
 */
export function emptySections(
  env: Env,
  scopeLabel: string,
  current: SpaceEntry | undefined,
): BuiltSection[] {
  const { labels } = env;
  const pages = pagesSection(env, scopeLabel);
  const recent = recentSection(env);

  if (current !== undefined && !current.connected)
    return [recent, pages, { id: 'connect', rows: [connectRow('connect', undefined, labels)] }];

  const assigned = assignedSection(env);
  if (recent.rows.length === 0 && assigned.rows.length === 0)
    return [{ id: 'hint', rows: [hintRow('type', labels.rows.typeHint)] }, pages];
  return [recent, pages, assigned];
}

/** 根: 切り替え先のスペース（未接続は connect 行）と共通のページ（D-20） */
export function rootSections({ index, scope, labels }: Env): BuiltSection[] {
  return [
    {
      id: 'spaces',
      label: labels.sections.spaces,
      rows: index.spaces.map((space) => spaceRow('spaces', space, labels)),
    },
    {
      id: 'common',
      label: labels.sections.commonPages,
      rows: index.pagesFor(scope).map((page) => pageRow('common', page, labels.rows.commonPageSub)),
    },
  ];
}

/** コマンド階層の引数。候補は混ぜない（§8）。スペースを切り替えの引数はスペース一覧 */
export function argumentSections({ index, labels }: Env): BuiltSection[] {
  return [{ id: 'args', rows: index.spaces.map((space) => spaceRow('args', space, labels)) }];
}
