import type { BootstrapState, PaletteSection, Surface } from '../messaging/ext.ts';
import type { RowView } from '../messaging/rowView.ts';
import type { PageContext } from '../messaging/window.ts';
import { recentVisits } from '../storage/displayCache.ts';
import { type DisplayCacheEntry, settingsItem, spacesItem } from '../storage/schema.ts';
import { buildLocalIndex } from './localIndex.ts';
import { loadAssignedIssues } from './masters/index.ts';

const KIND_TO_ROW: Record<DisplayCacheEntry['kind'], RowView['kind']> = {
  issue: 'issue',
  wiki: 'wiki',
  document: 'document',
  project: 'project',
};

const ISSUE_KEY = /^[A-Z][A-Z0-9_]*-\d+$/;

function toRow(entry: DisplayCacheEntry, index: number): RowView & { id: string } {
  const code = ISSUE_KEY.test(entry.title) ? entry.title : undefined;

  return {
    id: `recent-${index}`,
    kind: KIND_TO_ROW[entry.kind],
    title: entry.title,
    ...(code === undefined ? {} : { code }),
    ...(entry.projectName === undefined ? {} : { sub: entry.projectName }),
  };
}

/**
 * 空状態は API 応答を待たずに描く（実装プラン §5.3・§14）。
 *
 * ここでは表示キャッシュしか読まない。担当課題のように API が必要なものは
 * 後から追記する経路（M3 以降）に分ける。未接続・認証前・オフラインでも
 * 同じ内容が出ることが、この分離の目的。
 */
export async function buildBootstrap(
  surface: Surface,
  ctx: PageContext,
  now: number,
): Promise<BootstrapState> {
  const [visits, spaces, settings, local] = await Promise.all([
    recentVisits(now, surface === 'modal' ? 8 : 12),
    spacesItem.getValue(),
    settingsItem.getValue(),
    buildLocalIndex(ctx, now),
  ]);

  const sections: PaletteSection[] = [];

  if (visits.length > 0) {
    sections.push({
      id: 'recent',
      label: '最近開いた',
      ...(settings.learningEnabled ? { meta: '学習で並び替え' } : {}),
      rows: visits.map(toRow),
    });
  }

  /*
   * 現在プロジェクトのページ（モック A1）。索引から拾うだけで API を呼ばない。
   * 担当課題のように API が要るものは後から追記する経路に分ける（§5.3・§14）。
   */
  if (ctx.projectKey !== undefined) {
    const pages = local.entries
      .filter((entry) => entry.kind === 'page' && entry.context === 'currentProject')
      .slice(0, 6)
      .map((entry) => ({
        id: entry.id,
        kind: 'page' as const,
        title: entry.text,
        ...(entry.sub === undefined ? {} : { sub: entry.sub }),
      }));

    if (pages.length > 0) {
      sections.push({ id: 'pages', label: `${ctx.projectKey} のページ`, rows: pages });
    }
  }

  const withSelection = sections.map((section, sectionIndex) => ({
    ...section,
    rows: section.rows.map((row, rowIndex) => ({
      ...row,
      selected: sectionIndex === 0 && rowIndex === 0,
      hint: sectionIndex === 0 && rowIndex === 0 ? ('enter' as const) : ('none' as const),
    })),
  }));

  return {
    sections: withSelection,
    index: local.entries,
    actions: local.actions,
    connectedSpaces: spaces.map((space) => ({
      spaceKey: space.spaceKey,
      displayName: space.displayName,
    })),
    learningEnabled: settings.learningEnabled,
  };
}

/**
 * 担当中の課題のセクション（モック A1）。
 *
 * 空状態の初回描画には含めない。API 応答を待つと「⌘K を押しても何も出ない」
 * 時間ができる（§14）。届いた時点で追記する。
 */
export async function buildAssignedSection(
  spaceKey: string,
  now: number,
): Promise<PaletteSection | undefined> {
  const issues = await loadAssignedIssues(spaceKey, now);
  if (issues.length === 0) return undefined;

  return {
    id: 'assigned',
    label: '担当中の課題',
    meta: `${issues.length} 件`,
    rows: issues.map((issue) => ({
      id: `assigned:${issue.issueKey}`,
      kind: 'issue' as const,
      code: issue.issueKey,
      title: issue.summary,
      ...(issue.projectName === undefined ? {} : { sub: issue.projectName }),
      marker: { label: issue.statusName, tone: 'info' as const },
    })),
  };
}
