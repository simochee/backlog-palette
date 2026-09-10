import { storage } from 'wxt/utils/storage';
import { listConnections } from '../auth/connect.ts';
import type { BacklogClient } from '../backlog/index.ts';
import { spaceClientFor } from './spaceClient.ts';

/**
 * スペースごとのマスタ（実装プラン §9 の `local:masters:{spaceId}`）。
 *
 * プロジェクト一覧は課題検索の `projectId[]` に、ステータス名は
 * `detectConditions` の語彙になる（§7.1）。
 */

export const MASTERS_TTL_MS = 24 * 60 * 60 * 1000;

export type MasterProject = {
  id: number;
  projectKey: string;
  name: string;
};

export type MasterStatus = {
  id: number;
  name: string;
  color?: string;
};

export type SpaceMasters = {
  spaceKey: string;
  projects: readonly MasterProject[];
  /** プロジェクトごとのステータス。detectConditions の語彙になる */
  statuses: Record<string, readonly MasterStatus[]>;
  myUserId?: number;
  fetchedAt: number;
};

const KEY_PREFIX = 'masters:';

function defineMastersItem(spaceKey: string) {
  return storage.defineItem<SpaceMasters>(`local:${KEY_PREFIX}${spaceKey}`, { version: 1 });
}

const items = new Map<string, ReturnType<typeof defineMastersItem>>();

function mastersItem(spaceKey: string): ReturnType<typeof defineMastersItem> {
  const existing = items.get(spaceKey);
  if (existing !== undefined) return existing;

  const created = defineMastersItem(spaceKey);
  items.set(spaceKey, created);
  return created;
}

/*
 * 自分の情報は `users/myself` から取る。スペースのユーザー一覧 `GET /users` は
 * 管理者かプロジェクト管理者でないと 403 になり（docs/backlog-facts.md §3.5）、
 * 一般ユーザーでは先読みが丸ごと失敗する。
 */
async function fetchMyUserId(client: BacklogClient): Promise<number | undefined> {
  const me = await client.get<{ id?: number }>('users/myself');
  return typeof me.id === 'number' ? me.id : undefined;
}

function toProject(project: { id: number; projectKey: string; name: string }): MasterProject {
  return { id: project.id, projectKey: project.projectKey, name: project.name };
}

async function fetchMasters(spaceKey: string, now: number): Promise<SpaceMasters | undefined> {
  const client = await spaceClientFor(spaceKey);
  if (client === undefined) return undefined;

  /*
   * 自分の ID が取れなくてもプロジェクト一覧は使える。担当課題（assignedIssues.ts）
   * だけが諦めればよく、プロジェクト切替まで巻き添えにしない。
   */
  const [projects, myUserId] = await Promise.all([
    client.projects(),
    fetchMyUserId(client).catch(() => undefined),
  ]);

  return {
    spaceKey,
    projects: projects.filter((project) => !project.archived).map(toProject),
    /*
     * ステータスは先読みしない。プロジェクトごとに 1 リクエスト要る（台帳 §3.5）ため、
     * 数十プロジェクトのスペースでは起動直後に read 枠をその数だけ消費する。
     * 語彙として実際に要るのは今いるプロジェクトのぶんだけなので、
     * loadProjectStatuses で必要になった時点で足す。
     */
    statuses: {},
    ...(myUserId === undefined ? {} : { myUserId }),
    fetchedAt: now,
  };
}

/** キャッシュがあり TTL 内ならそれを返す。無ければ取りに行く */
export async function loadMasters(
  spaceKey: string,
  now: number,
): Promise<SpaceMasters | undefined> {
  const item = mastersItem(spaceKey);
  const cached = await item.getValue();
  if (cached !== null && now - cached.fetchedAt < MASTERS_TTL_MS) return cached;

  try {
    const fetched = await fetchMasters(spaceKey, now);
    if (fetched === undefined) return undefined;

    await item.setValue(fetched);
    return fetched;
  } catch {
    /*
     * 失敗をここで飲む。マスタが無くてもパレットはページ移動と表示キャッシュだけで
     * 成立する（§9）ので、呼び出し側に「マスタが無い」以上の分岐を持たせない。
     */
    return undefined;
  }
}

/** 接続済み全スペースぶん。1 スペースの失敗が他を止めない */
export async function loadAllMasters(now: number): Promise<readonly SpaceMasters[]> {
  const connections = await listConnections();
  const loaded = await Promise.all(
    connections.map((connection) => loadMasters(connection.spaceKey, now)),
  );

  return loaded.filter((masters): masters is SpaceMasters => masters !== undefined);
}

/**
 * そのプロジェクトのステータス。先読みでは引かず、ここで引いてマスタに足す。
 *
 * 呼ぶたびに API を叩かない。一度足せば同じマスタの TTL が切れるまで残る。
 */
export async function loadProjectStatuses(
  spaceKey: string,
  projectKey: string,
  now: number,
): Promise<readonly MasterStatus[]> {
  const masters = await loadMasters(spaceKey, now);
  if (masters === undefined) return [];

  const cached = masters.statuses[projectKey];
  if (cached !== undefined) return cached;

  const client = await spaceClientFor(spaceKey);
  if (client === undefined) return [];

  try {
    const statuses = (await client.statuses(projectKey)).map((status) => ({
      id: status.id,
      name: status.name,
      ...(status.color === undefined ? {} : { color: status.color }),
    }));

    await mastersItem(spaceKey).setValue({
      ...masters,
      statuses: { ...masters.statuses, [projectKey]: statuses },
    });

    return statuses;
  } catch {
    return [];
  }
}

export async function invalidateMasters(spaceKey?: string): Promise<void> {
  if (spaceKey !== undefined) {
    await mastersItem(spaceKey).removeValue();
    return;
  }

  /*
   * 接続一覧からではなく実際のキーから消す。接続を解除したスペースのマスタが
   * 残っていても消せるようにしておく。
   */
  const stored = await storage.snapshot('local');
  const keys = Object.keys(stored).filter((key) => key.startsWith(KEY_PREFIX));

  await Promise.all(keys.map((key) => storage.removeItem(`local:${key}`)));
}
