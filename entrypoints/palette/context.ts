import { spaceHostOf } from '@/lib/backlog/host';
import { pageKindOf, parsePath } from '@/lib/nav';
import { stackOf } from '@/lib/stack/stack';
import type { ProjectSegment, SpaceSegment, Stack } from '@/lib/stack/types';
import { readCurrentTab } from '@/lib/tabs';

/** 開いた瞬間のタブから読んだ文脈。鍵とスペースの選択はここだけを根拠にする（I7） */
export type OpenContext = {
  origin: string;
  /** スペースの識別子はホスト名（D-32） */
  spaceHost: string;
  pathname: string;
  projectKey: string | undefined;
  issueKey: string | undefined;
  /** 現在ページの種別。遷移パターンの from（D-16） */
  pageKind: string | undefined;
};

/**
 * どのスペースのパレットかは、content script の PageContext ではなく拡張ページ自身が
 * tabs API で読んだ URL で決める（tech-stack.md §2）。スペースの URL でなければ開かない
 */
export async function readOpenContext(): Promise<OpenContext | undefined> {
  const tab = await readCurrentTab();
  if (tab?.url === undefined) return undefined;
  const url = new URL(tab.url);
  const spaceHost = spaceHostOf(url.origin);
  if (spaceHost === undefined) return undefined;
  const info = parsePath(url.pathname);
  return {
    origin: url.origin,
    spaceHost,
    pathname: url.pathname,
    projectKey: info !== undefined && 'projectKey' in info ? info.projectKey : undefined,
    issueKey: info?.kind === 'issue' ? info.issueKey : undefined,
    pageKind: pageKindOf(url.pathname),
  };
}

export type SpaceLabel = { name: string; icon?: string };

export function spaceSegmentOf(host: string, label: SpaceLabel | undefined): SpaceSegment {
  return { kind: 'space', spaceId: host, label: label?.name ?? host, icon: label?.icon };
}

/*
 * プロジェクトの id と表示名にプロジェクトキーを使う。Backlog の数値 ID と名前はマスタ
 * （GET /projects、M4）が要り、開いた瞬間には無いことがある。キーは URL から必ず読めるので、
 * マスタが届くまでの識別子として使い、届いたら container が差し替える
 */
export function projectSegmentOf(projectKey: string | undefined): ProjectSegment | undefined {
  if (projectKey === undefined) return undefined;
  return { kind: 'project', projectId: projectKey, projectKey, label: projectKey };
}

/** 開いたときの既定のスタック。課題・プロジェクト配下なら [space / project]、直下なら [space]（palette.md §3） */
export function initialStackOf(context: OpenContext, label: SpaceLabel | undefined): Stack {
  return stackOf(spaceSegmentOf(context.spaceHost, label), projectSegmentOf(context.projectKey));
}
