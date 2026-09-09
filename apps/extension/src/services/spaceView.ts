import { type SpaceConnection, spacesItem } from '../storage/schema.ts';

export type SpaceSummary = {
  spaceKey: string;
  displayName: string;
  /** ホスト・認証方式・最終同期を 1 行にまとめたもの */
  detail: string;
  state: SpaceConnection['state'];
};

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const METHOD_LABEL: Record<SpaceConnection['method'], string> = {
  oauth: 'OAuth',
  apiKey: 'API キー',
};

function syncLabel(lastSyncedAt: number | undefined, now: number): string {
  if (lastSyncedAt === undefined) return 'まだ同期していません';

  const elapsed = Math.max(0, now - lastSyncedAt);
  if (elapsed < MINUTE) return 'たった今同期';
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)} 分前に同期`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)} 時間前に同期`;
  return `${Math.floor(elapsed / DAY)} 日前に同期`;
}

export function summarizeSpace(space: SpaceConnection, now: number): SpaceSummary {
  return {
    spaceKey: space.spaceKey,
    displayName: space.displayName,
    detail: [space.host, METHOD_LABEL[space.method], syncLabel(space.lastSyncedAt, now)].join(
      ' · ',
    ),
    state: space.state,
  };
}

/** 要再接続を先に出す。放っておくと検索から静かに欠ける唯一の状態なので */
export function summarizeSpaces(
  spaces: readonly SpaceConnection[],
  now: number,
): readonly SpaceSummary[] {
  return [...spaces]
    .sort((a, b) => Number(b.state === 'needsReconnect') - Number(a.state === 'needsReconnect'))
    .map((space) => summarizeSpace(space, now));
}

export async function loadSpaceSummaries(now: number): Promise<readonly SpaceSummary[]> {
  return summarizeSpaces(await spacesItem.getValue(), now);
}
