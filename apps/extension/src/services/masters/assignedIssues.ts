import { storage } from 'wxt/utils/storage';
import type { BacklogIssue } from '../backlog/index.ts';
import { loadMasters, type SpaceMasters } from './masters.ts';
import { spaceClientFor } from './spaceClient.ts';

/**
 * 空状態の「担当中の課題」（モック A1、実装プラン §5.1）。
 *
 * 検索枠を消費する（台帳 §3.6）ので、呼ぶのは空状態を出すときだけ。
 * 打鍵ごとの候補計算からは呼ばない（§14）。
 */

/**
 * 空状態は ⌘K のたびに描かれる。24h では担当の入れ替わりに追従できず、
 * 都度取得では 1 分 150 の検索枠を空状態だけで削る。数分の遅れは
 * 「後から追記される」表示（§14）に収まるので、そのあいだは使い回す。
 */
export const ASSIGNED_ISSUES_TTL_MS = 5 * 60 * 1000;

export const DEFAULT_ASSIGNED_ISSUE_LIMIT = 5;

/*
 * 完了は `statusId[]` で除外せず、引いてから落とす。除外するにはプロジェクトごとの
 * ステータス一覧が要り（カスタムステータスの id はプロジェクトごとに違う。台帳 §3.5）、
 * ステータスを遅延取得する方針（masters.ts）と噛み合わない。完了は既定ステータスなので
 * id が固定される。
 */
const COMPLETED_STATUS_ID = 4;

export type AssignedIssue = {
  issueKey: string;
  summary: string;
  projectName?: string;
  statusName: string;
  updatedAt: string;
};

type CachedAssignedIssues = {
  issues: readonly AssignedIssue[];
  fetchedAt: number;
};

function defineAssignedItem(spaceKey: string) {
  return storage.defineItem<CachedAssignedIssues>(`local:assignedIssues:${spaceKey}`, {
    version: 1,
  });
}

const items = new Map<string, ReturnType<typeof defineAssignedItem>>();

function assignedItem(spaceKey: string): ReturnType<typeof defineAssignedItem> {
  const existing = items.get(spaceKey);
  if (existing !== undefined) return existing;

  const created = defineAssignedItem(spaceKey);
  items.set(spaceKey, created);
  return created;
}

/** 完了を落とす前提で、表示する件数より多めに引く */
function fetchCount(limit: number): number {
  return Math.min(100, Math.max(limit * 4, 20));
}

function toAssignedIssue(issue: BacklogIssue, masters: SpaceMasters): AssignedIssue {
  const project = masters.projects.find((candidate) => candidate.id === issue.projectId);

  return {
    issueKey: issue.issueKey,
    summary: issue.summary,
    ...(project === undefined ? {} : { projectName: project.name }),
    statusName: issue.status.name,
    updatedAt: issue.updated,
  };
}

async function fetchAssignedIssues(
  spaceKey: string,
  now: number,
  limit: number,
): Promise<readonly AssignedIssue[] | undefined> {
  const masters = await loadMasters(spaceKey, now);
  if (masters === undefined || masters.myUserId === undefined) return undefined;

  /* `GET /issues` はプロジェクト指定が無いとエラーになる（台帳 §6.3） */
  const [firstProjectId, ...restProjectIds] = masters.projects.map((project) => project.id);
  if (firstProjectId === undefined) return undefined;

  const client = await spaceClientFor(spaceKey);
  if (client === undefined) return undefined;

  try {
    const issues = await client.issues({
      projectId: [firstProjectId, ...restProjectIds],
      assigneeId: [masters.myUserId],
      sort: 'updated',
      order: 'desc',
      count: fetchCount(limit),
    });

    return issues
      .filter((issue) => issue.status.id !== COMPLETED_STATUS_ID)
      .map((issue) => toAssignedIssue(issue, masters));
  } catch {
    return undefined;
  }
}

/** 自分が担当で未完了の課題を、更新の新しい順に上位 N 件 */
export async function loadAssignedIssues(
  spaceKey: string,
  now: number,
  limit: number = DEFAULT_ASSIGNED_ISSUE_LIMIT,
): Promise<readonly AssignedIssue[]> {
  const item = assignedItem(spaceKey);
  const cached = await item.getValue();
  if (cached !== null && now - cached.fetchedAt < ASSIGNED_ISSUES_TTL_MS) {
    return cached.issues.slice(0, limit);
  }

  const issues = await fetchAssignedIssues(spaceKey, now, limit);
  /* 失敗はキャッシュしない。空を数分保持すると、復旧しても空状態が空のままになる */
  if (issues === undefined) return [];

  await item.setValue({ issues, fetchedAt: now });
  return issues.slice(0, limit);
}

export async function invalidateAssignedIssues(spaceKey: string): Promise<void> {
  await assignedItem(spaceKey).removeValue();
}
