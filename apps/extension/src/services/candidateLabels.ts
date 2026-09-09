import type { CandidateLabels } from '@backlog-palette/core';

/**
 * 候補の文言。`packages/core` は文言を持たない（§8 の分離）。
 *
 * 文言の外部化（@wxt-dev/i18n）は M6。それまでここに置く。
 */
export const CANDIDATE_LABELS: CandidateLabels = {
  searchInPanel: (term) => `「${term}」をサイドパネルで検索`,
  searchInPanelSub: '課題・Wiki・ドキュメントを全文検索',
  openIssueDirectly: 'この課題を直接開く',
  openIssueDirectlySub: (projectKey) => `${projectKey} · 課題キーで移動`,
  sectionRecent: '最近開いた',
  sectionPages: 'ページ',
  sectionCommands: 'コマンド',
  sectionPrefixMatch: '前方一致する課題',
};
