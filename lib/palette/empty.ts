import type { Labels } from '@/components/labels';
import type { Badge } from '@/components/types';
import { frecencyByEntity } from '@/lib/rank/frecency';
import { transitionScores } from '@/lib/rank/transitions';
import type { SearchError } from '@/lib/search/types';
import type { CommandSegment, Scope } from '@/lib/stack/types';

import { copyCandidates, copyIssueCommand, copyIssueRow } from './candidates';
import { dueBadge } from './due';
import { type CachedEntry, entityId, type PaletteIndex, type SpaceEntry } from './model';
import {
  build,
  type Built,
  connectRow,
  entityRow,
  hintRow,
  loadingRow,
  pageRow,
  projectRow,
  spaceRow,
} from './rows';
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

/**
 * 今いるページは出さない。最頻・最直近なので何もしなければ先頭に来るが、開いても何も起きない。
 * 除くと先頭行が「直前に見ていた別のもの」になり、`⌘K` → `↵` が「戻る」として使える
 */
const isHere = (index: PaletteIndex, url: string): boolean => url === index.currentUrl;

function recentSection({ index, scope, labels }: Env): BuiltSection {
  const scores = frecencyByEntity(index.activity, index.now);
  const rows: { built: Built; score: number }[] = [];

  // 補足は行が持つ情報（担当者・最終更新・プロジェクトキー）をそのまま使う。
  // 「· 最近開いた」を足すと見出しの繰り返しになり、全行が 2 行組に太る
  for (const entry of index.cache) {
    if (!inScope(scope, entry.spaceId) || isHere(index, entry.url)) continue;
    const score = scores.get(entityId(entry.kind, entry.id));
    if (score !== undefined) rows.push({ built: entityRow('recent', entry, labels), score });
  }
  for (const project of index.projects) {
    if (!inScope(scope, project.spaceId) || isHere(index, project.url)) continue;
    const score = scores.get(entityId('project', project.id));
    const space = spaceOf(index, project.spaceId);
    if (score !== undefined && space !== undefined)
      rows.push({ built: projectRow('recent', project, space, labels), score });
  }

  // 同じ対象は 1 行。URL の書き方が違うだけの行が表示キャッシュに 2 件あっても、
  // 「最近開いた」に 2 回並ばない（D-52。移行が走らない経路への守り）
  const seen = new Set<string>();
  const unique = rows
    .toSorted((a, b) => b.score - a.score)
    .filter(({ built }) => !seen.has(built.row.id) && seen.add(built.row.id) !== undefined);

  return {
    id: 'recent',
    label: labels.sections.recent,
    meta: index.learningEnabled ? labels.sections.learned : undefined,
    rows: unique.map((r) => r.built),
    cap: SECTION_CAP,
  };
}

/** {現在の文脈} のページ。遷移パターンはこのセクション内の並びにだけ効く（D-16） */
function pagesSection({ index, scope, labels }: Env, scopeLabel: string): BuiltSection {
  const pages = index.pagesFor(scope).filter((page) => !isHere(index, page.url));
  const from = index.currentPageKind;
  const scores =
    from === undefined
      ? new Map<string, number>()
      : transitionScores(index.transitions, from, index.now);
  const ordered = pages
    .map((page, order) => ({ page, order, score: scores.get(page.id) ?? 0 }))
    .toSorted((a, b) => b.score - a.score || a.order - b.order);
  // 補足を置かない。見出しが「{scopeLabel} のページ」と言っているので繰り返しになる
  return {
    id: 'pages',
    label: labels.sections.pagesOf(scopeLabel),
    rows: ordered.map(({ page }) => pageRow('pages', page)),
    cap: SECTION_CAP,
  };
}

/**
 * 完了した課題に期限の警告は出さない。「担当中の課題」は完了を除くので普段は届かないが、
 * 再検証（D-14）で完了になった行がそのまま残ることがある。`done` は完了ステータスの役割 tone
 */
function dueBadgeFor(entry: CachedEntry, now: number, labels: Labels): Badge | undefined {
  if (entry.status?.tone === 'done') return undefined;
  return dueBadge(entry.dueDate, now, labels);
}

/**
 * 取得に失敗したことを行として出す（I6）。認証切れだけは再接続へ運べるので動作を持ち、
 * それ以外は原因を述べるだけ。押せない行にヒントは出ない（I1）
 */
function assignedErrorRow(
  error: SearchError,
  space: SpaceEntry | undefined,
  labels: Labels,
): Built {
  if (error.kind === 'unauthorized')
    return build(
      'assigned:status',
      { kind: 'status', title: labels.rows.authExpired(space?.label ?? ''), tone: 'danger' },
      { type: 'connect', spaceId: space?.id },
    );
  // 検索の offline 行（「接続すると再検索します」）は流用しない。担当課題は引き直さない
  const title = error.kind === 'offline' ? labels.rows.assignedOffline : labels.rows.assignedFailed;
  return build('assigned:status', { kind: 'status', title, tone: 'danger' });
}

/**
 * 担当課題だけが API を待つ。届くまでセクションごと消しておくと「出ない機能」に見え、
 * 到着でリストが下に伸びる。見出しとプレースホルダを先に出し、届いたら置き換える（§7.2 と同じ形）
 */
function assignedSection({ index, labels }: Env, space: SpaceEntry | undefined): BuiltSection {
  const assigned = index.assigned;
  const head = { id: 'assigned', label: labels.sections.assigned, cap: SECTION_CAP };
  if (assigned.kind === 'loading')
    return { ...head, rows: [loadingRow('assigned', labels.rows.loading)] };
  if (assigned.kind === 'failed')
    return { ...head, rows: [assignedErrorRow(assigned.error, space, labels)] };
  return {
    ...head,
    // 取得は SECTION_CAP 件で打ち切るので、それに達した件数は総数ではない。数えられるときだけ出す
    meta:
      assigned.rows.length < SECTION_CAP ? labels.sections.count(assigned.rows.length) : undefined,
    rows: assigned.rows.map((entry) =>
      entityRow('assigned', entry, labels, { due: dueBadgeFor(entry, index.now, labels) }),
    ),
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

  const assigned = assignedSection(env, current);
  // 今いる課題に対してできること。先頭には置かない。先頭行は「戻る先」のまま残す（D-37）
  const thisIssue = copyIssueRow(env);
  const issue =
    thisIssue === undefined
      ? []
      : [{ id: 'issue', label: labels.sections.thisIssue, rows: [thisIssue] }];
  // 案内を出すかは「思い出せるものがあるか」だけで決める。担当課題の到着で消えると
  // 選択が別の行へ飛ぶ（I4）。末尾に置き、上から試して駄目なら打つ、の順にする
  const hint =
    recent.rows.length === 0 ? [{ id: 'hint', rows: [hintRow('type', labels.rows.typeHint)] }] : [];
  return [recent, ...issue, pages, assigned, ...hint];
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

/** コマンド階層の引数。候補は混ぜない（§8）。引数の中身は積まれているコマンドで決まる */
export function argumentSections(env: Env, command: CommandSegment): BuiltSection[] {
  const { index, labels } = env;
  const rows =
    command.commandId === copyIssueCommand.commandId
      ? copyCandidates(env, 'args').map((candidate) => candidate.built)
      : index.spaces.map((space) => spaceRow('args', space, labels));
  return [{ id: 'args', rows }];
}
