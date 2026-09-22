import type { Labels } from '@/components/labels';
import {
  EXTERNAL_ROW_ID,
  MORE_EXTERNAL_ROW_ID,
  NO_RESULTS_ROW_ID,
  NOTICE_ROW_ID,
  PANEL_ROW_ID,
  PLACEHOLDER_ROW_ID,
  resultRowId,
  statusRowId,
  WIDEN_ROW_ID,
} from '@/lib/search/ids';
import { errorOf, isDone, isEmpty, totalCount } from '@/lib/search/session';
import {
  type ResultRow,
  type SearchKind,
  searchKinds,
  type SearchSession,
} from '@/lib/search/types';
import type { Scope } from '@/lib/stack/types';

import type { PaletteIndex, SpaceEntry } from './model';
import { build, type Built } from './rows';
import type { BuiltSection } from './sections';

type Env = { index: PaletteIndex; scope: Scope; labels: Labels; panelAvailable: boolean };

function resultRow(row: ResultRow, labels: Labels): Built {
  const detail =
    row.kind === 'issue'
      ? row.assignee
      : row.updatedBy === undefined
        ? undefined
        : labels.rows.updatedBy(row.updatedBy);
  return build(
    resultRowId(row),
    {
      kind: row.kind,
      code: row.key,
      title: row.title,
      sub: [row.projectName, detail].filter((p) => p !== undefined).join(' · '),
      marker: row.status,
      tag: row.type,
    },
    { type: 'navigate', url: row.url },
    { kind: 'complete', text: row.key ?? row.title },
  );
}

function kindLabel(kind: SearchKind, labels: Labels): string {
  return labels.panel.options[kind];
}

/**
 * 見出しの補足: `課題 12 · Wiki 読み込み中 · ドキュメント 2`。全部揃ったら `17 件`（§7.2）。
 * 種別の進捗が全部同じときは何も言わない。同じ 1 語をセクションの中の行が既に言っており、
 * 「検索中」が 3 か所（検索行の補足・見出し・プレースホルダ行）に並ぶと読む場所が散る（D-49）
 */
export function progressMeta(session: SearchSession, labels: Labels): string | undefined {
  if (errorOf(session, 'unauthorized') !== undefined) return labels.panel.authExpired;
  if (isDone(session)) {
    const total = totalCount(session);
    return total === 0 ? undefined : labels.sections.count(total);
  }
  if (searchKinds.every((kind) => session.kinds[kind].state === 'loading')) return undefined;
  return searchKinds
    .map((kind) => {
      const progress = session.kinds[kind];
      const value =
        progress.state === 'ready'
          ? String(progress.count)
          : progress.state === 'loading'
            ? labels.panel.loading
            : progress.error.kind === 'unauthorized'
              ? labels.panel.reconnect
              : labels.panel.failed;
      return `${kindLabel(kind, labels)} ${value}`;
    })
    .join(' · ');
}

/** 検索行の補足は進捗に変わる（§7.2・§7.5） */
export function searchRowSub(
  session: SearchSession,
  space: SpaceEntry | undefined,
  labels: Labels,
): string {
  const spaceLabel = space?.label ?? '';
  if (errorOf(session, 'unauthorized') !== undefined) return labels.rows.authExpired(spaceLabel);
  if (errorOf(session, 'offline') !== undefined) return labels.rows.offline;
  if (isDone(session)) return labels.sections.count(totalCount(session));
  return `${spaceLabel} · ${labels.rows.searching}`;
}

/** 0 件の提案は スコープを広げる → 詳細検索 → 本体検索 の順で固定（§7.5・D-19） */
function emptyRows(
  { index, scope, labels, panelAvailable }: Env,
  session: SearchSession,
  space: SpaceEntry | undefined,
): Built[] {
  const rows = [build(NO_RESULTS_ROW_ID, { kind: 'hint', title: labels.rows.noResults })];
  if (scope.kind === 'project' && space !== undefined)
    rows.push(
      build(
        WIDEN_ROW_ID,
        { kind: 'search', title: labels.rows.widenTo(space.label), tone: 'accent' },
        { type: 'search', query: session.query, scope: { kind: 'space', spaceId: scope.spaceId } },
      ),
    );
  if (panelAvailable)
    rows.push(
      build(
        PANEL_ROW_ID,
        { kind: 'panel', title: labels.rows.toPanel, sub: labels.rows.toPanelSub },
        { type: 'openPanel' },
      ),
    );
  rows.push(
    build(
      EXTERNAL_ROW_ID,
      {
        kind: 'external',
        title: labels.rows.openExternal,
        // 生の URL は次に何が起きるかを説明しない。URL は title 属性が持つ
        sub: labels.rows.openExternalSub(space?.label ?? ''),
      },
      { type: 'navigate', url: index.externalSearchUrl(scope, session.query) },
    ),
  );
  return rows;
}

function errorRows(
  env: Env,
  session: SearchSession,
  space: SpaceEntry | undefined,
): Built[] | undefined {
  const { labels } = env;
  const spaceLabel = space?.label ?? '';
  const id = statusRowId(space?.id ?? 'current');
  if (errorOf(session, 'unauthorized') !== undefined)
    return [
      build(
        id,
        { kind: 'status', title: labels.rows.authExpired(spaceLabel), tone: 'danger' },
        { type: 'connect', spaceId: space?.id },
      ),
    ];
  const limited = errorOf(session, 'rateLimited');
  if (limited?.kind === 'rateLimited')
    return [
      build(
        id,
        {
          kind: 'status',
          title: labels.rows.rateLimited(spaceLabel, limited.retryAfterSeconds),
          tone: 'danger',
        },
        { type: 'retry' },
      ),
    ];
  return undefined;
}

/**
 * 検索結果セクション（§7）。到着前はプレースホルダ、保留があれば先頭に notice、
 * 上限超過は末尾に external。0 件と障害も行として出し、パレット全体は変えない（I6）
 */
export function resultsSection(env: Env, session: SearchSession): BuiltSection {
  const { index, scope, labels } = env;
  const space =
    scope.kind === 'root' ? undefined : index.spaces.find((s) => s.id === scope.spaceId);
  const meta = progressMeta(session, labels);
  const failed = errorRows(env, session, space);
  if (failed !== undefined && session.rows.length === 0)
    return { id: 'results', label: labels.sections.results, meta, uncapped: true, rows: failed };
  if (isEmpty(session))
    return {
      id: 'results',
      label: labels.sections.results,
      meta,
      rows: emptyRows(env, session, space),
    };

  const rows: Built[] = [];
  if (session.held.length > 0)
    rows.push(
      build(
        NOTICE_ROW_ID,
        { kind: 'notice', title: labels.rows.pending(session.held.length) },
        { type: 'mergeHeld' },
      ),
    );
  if (session.rows.length === 0)
    rows.push(
      build(PLACEHOLDER_ROW_ID, { kind: 'search', title: labels.rows.searching, busy: true }),
    );
  rows.push(...session.rows.map((row) => resultRow(row, labels)));
  if (session.overflow > 0) {
    const url = index.externalSearchUrl(scope, session.query);
    rows.push(
      build(
        MORE_EXTERNAL_ROW_ID,
        {
          kind: 'external',
          title: labels.rows.moreExternal(session.overflow),
          sub: labels.rows.openExternalSub(space?.label ?? ''),
        },
        { type: 'navigate', url },
      ),
    );
  }
  if (failed !== undefined) rows.push(...failed);
  return { id: 'results', label: labels.sections.results, meta, uncapped: true, rows };
}
