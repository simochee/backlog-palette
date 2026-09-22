import type { Badge, Tone } from '@/components/types';
import type { CachedEntry, EntityKind } from '@/lib/palette/model';

import { CLOSED_STATUS_ID } from './statuses';

/** パレットの行に載せる 1 件（lib/palette/model.ts）。spaceId はホスト（D-32） */
export type Entry = CachedEntry;
export type { EntityKind };

/** マスタとして持つプロジェクトの要約。GET /projects の応答から要る項目だけを残す */
export type ProjectRef = { id: number; projectKey: string; name: string; useWiki: boolean };

/*
 * backlog-js の Entity 型ではなく、行に要る項目だけの構造型で受ける。応答の全項目を
 * 揃えないとテストの入力が書けず、API の版が変わるたびに壊れる。
 */
type Named = { name: string };
export type IssueLike = {
  projectId: number;
  issueKey: string;
  summary: string;
  issueType: { name: string; color: string };
  status: { id: number; name: string };
  assignee?: Named;
  dueDate?: string | null;
  updatedUser: Named;
  updated: string;
};
export type WikiLike = {
  id: number;
  projectId: number;
  name: string;
  updatedUser: Named;
  updated: string;
};
export type DocumentLike = {
  id: string;
  projectId: number;
  title: string;
  updatedUser: Named;
  updated: string;
};

export const issueUrl = (host: string, issueKey: string): string =>
  `https://${host}/view/${issueKey}`;
export const wikiUrl = (host: string, wikiId: number): string =>
  `https://${host}/alias/wiki/${wikiId}`;
export const documentUrl = (host: string, projectKey: string, documentId: string): string =>
  `https://${host}/document/${projectKey}/${documentId}`;

const BUILT_IN_STATUS_TONES: Record<number, Tone> = {
  1: 'neutral',
  2: 'info',
  3: 'success',
  [CLOSED_STATUS_ID]: 'done',
};

export function statusBadge(status: { id: number; name: string }): Badge {
  return { label: status.name, tone: BUILT_IN_STATUS_TONES[status.id] ?? 'neutral' };
}

/* 種別の色は Backlog の 10 色固定。赤系だけを danger に寄せ、他は info（バグを目立たせる） */
const DANGER_TYPE_COLORS: ReadonlySet<string> = new Set(['#e30000', '#990000', '#ff3265']);

export function typeBadge(type: { name: string; color: string }): Badge {
  return { label: type.name, tone: DANGER_TYPE_COLORS.has(type.color) ? 'danger' : 'info' };
}

export function issueEntry(host: string, issue: IssueLike, project: ProjectRef): Entry {
  return {
    kind: 'issue',
    id: issue.issueKey,
    key: issue.issueKey,
    title: issue.summary,
    spaceId: host,
    projectId: String(project.id),
    projectName: project.name,
    ...(issue.assignee === undefined ? {} : { assignee: issue.assignee.name }),
    ...(issue.dueDate === undefined || issue.dueDate === null ? {} : { dueDate: issue.dueDate }),
    updatedBy: issue.updatedUser.name,
    status: statusBadge(issue.status),
    type: typeBadge(issue.issueType),
    url: issueUrl(host, issue.issueKey),
  };
}

export function wikiEntry(host: string, wiki: WikiLike, project: ProjectRef): Entry {
  return {
    kind: 'wiki',
    id: String(wiki.id),
    title: wiki.name,
    spaceId: host,
    projectId: String(project.id),
    projectName: project.name,
    updatedBy: wiki.updatedUser.name,
    url: wikiUrl(host, wiki.id),
  };
}

export function documentEntry(host: string, document: DocumentLike, project: ProjectRef): Entry {
  return {
    kind: 'document',
    id: document.id,
    title: document.title,
    spaceId: host,
    projectId: String(project.id),
    projectName: project.name,
    updatedBy: document.updatedUser.name,
    url: documentUrl(host, project.projectKey, document.id),
  };
}
