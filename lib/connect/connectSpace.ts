import { type ApiFailure, toApiFailure } from '@/lib/backlog/failure';
import type { RateLimitSnapshot } from '@/lib/backlog/rateLimit';

/** 接続済みスペースの記録。鍵は含めない（鍵は apiKeys item） */
export type ConnectedSpace = {
  name: string;
  spaceKey: string;
  projectCount: number;
  connectedAt: number;
};

/** backlog-js のうち接続の手順が使う 4 つ。テストでは偽物を渡す */
export type ConnectApi = {
  getMyself: () => Promise<unknown>;
  getSpace: () => Promise<{ spaceKey: string; name: string }>;
  getRateLimit: () => Promise<{ rateLimit: RateLimitSnapshot }>;
  getProjects: () => Promise<unknown[]>;
};

export type ConnectDeps = {
  createClient: (spaceHost: string, apiKey: string) => ConnectApi;
  saveApiKey: (spaceHost: string, apiKey: string) => Promise<void>;
  initializeRateLimit: (spaceHost: string, snapshot: RateLimitSnapshot) => Promise<void>;
  saveSpace: (spaceHost: string, space: ConnectedSpace) => Promise<void>;
  now?: () => number;
};

export type ConnectResult =
  | { ok: true; space: ConnectedSpace }
  | { ok: false; failure: ApiFailure };

async function initialize(
  api: ConnectApi,
  spaceHost: string,
  space: { spaceKey: string; name: string },
  deps: ConnectDeps,
): Promise<ConnectedSpace> {
  const [{ rateLimit }, projects] = await Promise.all([api.getRateLimit(), api.getProjects()]);
  await deps.initializeRateLimit(spaceHost, rateLimit);
  const connected: ConnectedSpace = {
    name: space.name,
    spaceKey: space.spaceKey,
    projectCount: projects.length,
    connectedAt: (deps.now ?? Date.now)(),
  };
  await deps.saveSpace(spaceHost, connected);
  return connected;
}

/**
 * キーを検証してから保存し、上限とプロジェクト一覧を初期化する（surfaces.md §1.2）。
 * 検証に失敗したキーは保存しない。初期化の失敗は接続の成立を妨げず、次回の取得に任せる。
 */
export async function connectSpace(
  spaceHost: string,
  apiKey: string,
  deps: ConnectDeps,
): Promise<ConnectResult> {
  const api = deps.createClient(spaceHost, apiKey);
  try {
    await api.getMyself();
    const space = await api.getSpace();
    await deps.saveApiKey(spaceHost, apiKey);
    return { ok: true, space: await initialize(api, spaceHost, space, deps) };
  } catch (error) {
    return { ok: false, failure: toApiFailure(error) };
  }
}
