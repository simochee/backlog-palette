import type { CandidateLabels } from '@backlog-palette/core';

/**
 * 候補の文言。`packages/core` は文言を持たない（§8 の分離）。
 *
 * 文言の外部化（@wxt-dev/i18n）は M6。それまでここに置く。
 */
export const CANDIDATE_LABELS: CandidateLabels = {
  /*
   * 実機で触って分かったこと: 打った語の結果がその場に出ないのは不自然だった。
   * 検索はパレットの中で行い、サイドパネルは「詳しく見る」側に回す。
   * 元の設計（モーダルは行く / パネルは探す）の前提が違っていた。
   */
  searchInPanel: (term) => `「${term}」を検索`,
  searchInPanelSub: '課題・Wiki・ドキュメントを横断',
  openIssueDirectly: 'この課題を直接開く',
  openIssueDirectlySub: (projectKey) => `${projectKey} · 課題キーで移動`,
  sectionRecent: '最近開いた',
  sectionPages: 'ページ',
  sectionCommands: 'コマンド',
  sectionPrefixMatch: '前方一致する課題',
};
