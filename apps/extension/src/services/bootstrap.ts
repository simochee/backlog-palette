import type { BootstrapState, PaletteSection, Surface } from '../messaging/ext.ts';
import type { RowView } from '../messaging/rowView.ts';
import { recentVisits } from '../storage/displayCache.ts';
import { type DisplayCacheEntry, settingsItem, spacesItem } from '../storage/schema.ts';

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
    hint: index === 0 ? 'enter' : 'none',
    selected: index === 0,
  };
}

/**
 * 空状態は API 応答を待たずに描く（実装プラン §5.3・§14）。
 *
 * ここでは表示キャッシュしか読まない。担当課題のように API が必要なものは
 * 後から追記する経路（M3 以降）に分ける。未接続・認証前・オフラインでも
 * 同じ内容が出ることが、この分離の目的。
 */
export async function buildBootstrap(surface: Surface, now: number): Promise<BootstrapState> {
  const [visits, spaces, settings] = await Promise.all([
    recentVisits(now, surface === 'modal' ? 8 : 12),
    spacesItem.getValue(),
    settingsItem.getValue(),
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

  return {
    sections,
    connectedSpaces: spaces.map((space) => ({
      spaceKey: space.spaceKey,
      displayName: space.displayName,
    })),
    learningEnabled: settings.learningEnabled,
  };
}
