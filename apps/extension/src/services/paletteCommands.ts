import {
  type CandidateRow,
  type CandidateSection,
  type IndexEntry,
  match,
} from '@backlog-palette/core';
import type { RowAction } from '../messaging/ext.ts';

/**
 * 選んでも遷移せず、スタックに積んで次の階層を出すコマンド（§3 D3・モック A7）。
 *
 * 引数は API を呼ばずに出せるものだけにする。モーダルは打鍵に同期して
 * 応答する約束（§7.2）なので、階層を開いた先で待たせない。
 */

export const SWITCH_SPACE = 'switch-space';
export const SWITCH_SPACE_LABEL = 'スペースを切り替え';

const SWITCH_SPACE_ROW = `command:${SWITCH_SPACE}`;
const SPACES_SECTION = 'spaces';

export type ConnectedSpace = { spaceKey: string; displayName: string };

export type TwoStageCommand = { commandId: string; label: string };

/** 1 段目の行。接続済みスペースが無いときは切り替え先も無いので出さない */
export function twoStageCommandEntries(spaces: readonly ConnectedSpace[]): IndexEntry[] {
  if (spaces.length === 0) return [];

  return [
    {
      id: SWITCH_SPACE_ROW,
      kind: 'command',
      text: SWITCH_SPACE_LABEL,
      aliases: ['すぺーす', 'space', 'switch'],
      sub: '接続済みのスペースへ移動',
      context: 'currentSpace',
    },
  ];
}

export function twoStageCommandOf(rowId: string): TwoStageCommand | undefined {
  if (rowId !== SWITCH_SPACE_ROW) return undefined;
  return { commandId: SWITCH_SPACE, label: SWITCH_SPACE_LABEL };
}

/** 押した先が遷移ではないことを、押す前に `›` で見せる（§5.2 の hint: 'more'） */
export function withTwoStageHints(sections: readonly CandidateSection[]): CandidateSection[] {
  return sections.map((section) => ({
    ...section,
    rows: section.rows.map((row) =>
      twoStageCommandOf(row.id) === undefined ? row : { ...row, hint: 'more' as const },
    ),
  }));
}

export type CommandStage = {
  sections: CandidateSection[];
  actions: Record<string, RowAction>;
};

export function switchSpaceStage(options: {
  spaces: readonly ConnectedSpace[];
  originOf: (spaceKey: string) => string | undefined;
  query: string;
}): CommandStage {
  const actions: Record<string, RowAction> = {};
  const rows: CandidateRow[] = [];

  for (const space of options.spaces) {
    const origin = options.originOf(space.spaceKey);
    if (origin === undefined || !matches(options.query, space)) continue;

    const id = `space:${space.spaceKey}`;
    rows.push({
      id,
      kind: 'space',
      title: space.displayName,
      sub: space.spaceKey,
      avatar: { label: space.spaceKey },
      hint: 'enter',
      selected: rows.length === 0,
    });
    actions[id] = { kind: 'navigate', url: `${origin}/dashboard`, target: 'currentTab' };
  }

  if (rows.length === 0) return { sections: [], actions: {} };

  return { sections: [{ id: SPACES_SECTION, label: 'スペース', rows }], actions };
}

function matches(query: string, space: ConnectedSpace): boolean {
  if (query.trim() === '') return true;
  return match(query, { text: space.displayName, aliases: [space.spaceKey] }).score > 0;
}

const PROJECT_ROW = /^project:([^:]+):/;

/**
 * 接続済みスペースの遷移先 origin。
 *
 * BootstrapState.connectedSpaces はスペースキーと表示名しか運ばない（§6.4 の契約）。
 * スペースキーからホストを組み立てると .backlog.jp / .backlog.com /
 * .backlogtool.com を取り違えるので、Service Worker が接続情報から組んだ
 * プロジェクト行の URL を出自として使う。今いるスペースだけはページの
 * origin が確実なので、そちらで上書きする。
 */
export function spaceOrigins(
  actions: Record<string, RowAction>,
  ctx: { origin: string; spaceKey?: string },
): Map<string, string> {
  const origins = new Map<string, string>();

  for (const [rowId, action] of Object.entries(actions)) {
    const spaceKey = PROJECT_ROW.exec(rowId)?.[1];
    if (spaceKey === undefined || action.kind !== 'navigate') continue;

    const origin = originOf(action.url);
    if (origin !== undefined) origins.set(spaceKey, origin);
  }

  if (ctx.spaceKey !== undefined) origins.set(ctx.spaceKey, ctx.origin);

  return origins;
}

function originOf(url: string): string | undefined {
  try {
    return new URL(url).origin;
  } catch {
    return undefined;
  }
}
