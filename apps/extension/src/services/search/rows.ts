import { compareRows, issueTypeTone, type RowView, statusTone } from '@backlog-palette/core';
import type {
  BacklogDocument,
  BacklogIssue,
  BacklogProject,
  BacklogWiki,
} from '../backlog/index.ts';

/**
 * API の応答をサイドパネルの 1 行へ写す（実装プラン §5.2・§7.4）。
 *
 * 遷移先の URL は `docs/backlog-facts.md` §1 の台帳に従う。
 */

export type SearchRow = RowView & {
  id: string;
  /** 遷移先 */
  url: string;
  /** 並び替えに使う。ISO 文字列ではなくエポックミリ秒 */
  updatedAt: number;
  spaceKey: string;
  kind: 'issue' | 'wiki' | 'document';
  /** プレビュー用の本文。無い種別もある */
  body?: string;
};

export type RowContext = {
  readonly spaceKey: string;
  readonly host: string;
};

function epochMs(updated: string): number {
  const parsed = Date.parse(updated);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function projectName(project: BacklogProject | undefined): { sub?: string } {
  return project === undefined ? {} : { sub: project.name };
}

function assignee(user: BacklogIssue['assignee']): { avatar?: { label: string } } {
  return user === undefined || user === null ? {} : { avatar: { label: user.name } };
}

function body(text: string | undefined): { body?: string } {
  return text === undefined || text === '' ? {} : { body: text };
}

export function issueRow(
  issue: BacklogIssue,
  project: BacklogProject | undefined,
  ctx: RowContext,
): SearchRow {
  return {
    id: `${ctx.spaceKey}:issue:${issue.id}`,
    kind: 'issue',
    code: issue.issueKey,
    title: issue.summary,
    ...projectName(project),
    marker: { label: issue.status.name, tone: statusTone(issue.status) },
    tag: { label: issue.issueType.name, tone: issueTypeTone(issue.issueType.name) },
    ...assignee(issue.assignee),
    url: `https://${ctx.host}/view/${issue.issueKey}`,
    updatedAt: epochMs(issue.updated),
    spaceKey: ctx.spaceKey,
    ...body(issue.description),
  };
}

/**
 * Wiki はページ名ではなく id で開く。名前は変わるうえに `/` を含められるので、
 * `/wiki/{projectKey}/{pageName}` を組み立てるとリンクが壊れうる（台帳 §1.2）。
 */
export function wikiRow(
  wiki: BacklogWiki,
  project: BacklogProject | undefined,
  ctx: RowContext,
): SearchRow {
  return {
    id: `${ctx.spaceKey}:wiki:${wiki.id}`,
    kind: 'wiki',
    title: wiki.name,
    ...projectName(project),
    url: `https://${ctx.host}/alias/wiki/${wiki.id}`,
    updatedAt: epochMs(wiki.updated),
    spaceKey: ctx.spaceKey,
    ...body(wiki.content),
  };
}

export function documentRow(
  document: BacklogDocument,
  project: BacklogProject,
  ctx: RowContext,
): SearchRow {
  return {
    id: `${ctx.spaceKey}:document:${document.id}`,
    kind: 'document',
    title: document.title,
    sub: project.name,
    url: `https://${ctx.host}/document/${project.projectKey}/${document.id}`,
    updatedAt: epochMs(document.updated),
    spaceKey: ctx.spaceKey,
    ...body(document.plain),
  };
}

/** チャンク内の並び（§3 D6）。合流後の並びと同じ規則を使う */
export function orderRows(
  rows: readonly SearchRow[],
  currentSpaceKey: string | undefined,
): readonly SearchRow[] {
  const ctx = currentSpaceKey === undefined ? {} : { currentSpaceKey };
  return [...rows].sort((a, b) => compareRows(a, b, ctx));
}
