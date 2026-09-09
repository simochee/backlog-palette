import {
  availablePages,
  buildCandidates,
  type CandidateSection,
  type IndexEntry,
  issueUrl,
  type NavContext,
} from '@backlog-palette/core';
import type { PageContext } from '../messaging/window.ts';
import { recentVisits } from '../storage/displayCache.ts';

/**
 * モーダルがローカルだけで応答するための索引（実装プラン §7.2）。
 *
 * API を呼ばない。ページ定義と表示キャッシュだけで組む。接続前・オフライン
 * でも同じ候補が出ることが、この構成の目的。
 */

const LABELS = {
  searchInPanel: (term: string) => `「${term}」をサイドパネルで検索`,
  searchInPanelSub: '課題・Wiki・ドキュメントを全文検索',
  openIssueDirectly: 'この課題を直接開く',
  openIssueDirectlySub: (projectKey: string) => `${projectKey} · 課題キーで移動`,
  sectionRecent: '最近開いた',
  sectionPages: 'ページ',
  sectionCommands: 'コマンド',
  sectionPrefixMatch: '前方一致する課題',
};

const ISSUE_KEY = /^[A-Z][A-Z0-9_]*-\d+$/;

function navContextOf(ctx: PageContext): NavContext {
  return {
    origin: ctx.origin,
    ...(ctx.projectKey === undefined ? {} : { projectKey: ctx.projectKey }),
  };
}

async function buildIndex(
  ctx: PageContext,
  now: number,
): Promise<{
  entries: IndexEntry[];
  urls: Map<string, string>;
}> {
  const entries: IndexEntry[] = [];
  const urls = new Map<string, string>();

  for (const page of availablePages(navContextOf(ctx))) {
    entries.push({
      id: `page:${page.id}`,
      kind: 'page',
      text: page.label,
      aliases: page.aliases,
      sub: page.scope === 'project' ? ctx.projectKey : 'スペース',
      context: page.scope === 'project' ? 'currentProject' : 'currentSpace',
    });
    urls.set(`page:${page.id}`, page.url);
  }

  for (const visit of await recentVisits(now, 30)) {
    const id = `recent:${visit.title}`;
    if (urls.has(id)) continue;

    const isIssue = visit.kind === 'issue' && ISSUE_KEY.test(visit.title);
    entries.push({
      id,
      kind: visit.kind,
      text: visit.title,
      ...(visit.projectName === undefined ? {} : { sub: visit.projectName }),
      context: 'currentSpace',
    });
    if (isIssue) urls.set(id, issueUrl(ctx.origin, visit.title));
  }

  return { entries, urls };
}

export type LocalResult = {
  sections: readonly CandidateSection[];
  /** 行 id → 遷移先。URL を持たない行は含まない */
  urls: Record<string, string>;
};

export async function localCandidates(
  input: string,
  ctx: PageContext,
  now: number,
): Promise<LocalResult> {
  const { entries, urls } = await buildIndex(ctx, now);

  const sections = buildCandidates({
    input,
    index: entries,
    /*
     * frecency はまだ記録していないので一律 0。行動ログの実装（M5）で
     * ここに実データが入る。学習をオフにしたら 0 のまま据え置く。
     */
    frecencyOf: () => 0,
    labels: LABELS,
    showSpaceBadges: false,
  });

  /*
   * 直接ジャンプの行だけは索引に無いのでここで URL を足す。
   * 行 id は buildCandidates が付ける `openIssue:{課題キー}` に合わせる。
   */
  const issueKey = input.trim();
  if (ISSUE_KEY.test(issueKey)) {
    urls.set(`openIssue:${issueKey}`, issueUrl(ctx.origin, issueKey));
  }

  return { sections, urls: Object.fromEntries(urls) };
}
