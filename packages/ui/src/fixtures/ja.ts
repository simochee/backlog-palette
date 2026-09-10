import type { PaletteRow, PaletteSection } from '../palette/PaletteSurface.tsx';
import type { PathSegment } from '../palette/PathStack.tsx';
import type { FilterField } from '../panel/FilterBar.tsx';
import type { PanelEmptyState } from '../panel/PanelSurface.tsx';
import type { PreviewProps } from '../panel/Preview.tsx';
import type { SpaceStatus } from '../panel/StatusStrip.tsx';
import type { TypeTab } from '../panel/TypeTabs.tsx';

/** モックのダミーデータ。日本語の長さと記号の混在を再現するのが目的 */

export const pathProject: readonly PathSegment[] = [
  { label: 'nulab', avatar: true, labelHidden: true },
  { label: 'Webリニューアル', avatar: true },
];

export const pathSpace: readonly PathSegment[] = [{ label: 'nulab', avatar: true }];

export const pathAllSpaces: readonly PathSegment[] = [{ label: '全スペース' }];

export const recentRows: readonly PaletteRow[] = [
  {
    id: 'PROJ-142',
    kind: 'issue',
    code: 'PROJ-142',
    title: '決済フローのエラーハンドリング',
    sub: 'Webリニューアル · 田中 拓也',
    marker: { label: '処理中', tone: 'info' },
    tag: { label: 'バグ', tone: 'danger' },
    hint: 'enter',
  },
  {
    id: 'wiki-release',
    kind: 'wiki',
    title: 'リリース手順書',
    sub: 'Webリニューアル · 最終更新 佐藤 美咲',
  },
  {
    id: 'MOB-88',
    kind: 'issue',
    code: 'MOB-88',
    title: 'プッシュ通知の許諾ダイアログ改修',
    sub: 'モバイルアプリ v3 · 佐藤 美咲',
    marker: { label: '未対応', tone: 'neutral' },
    tag: { label: 'タスク', tone: 'success' },
  },
  {
    id: 'doc-ops',
    kind: 'document',
    title: '2024Q3 情シス運用レポート',
    sub: '社内ヘルプデスク · ドキュメント',
  },
];

export const pageRows: readonly PaletteRow[] = [
  { id: 'page-board', kind: 'page', title: 'ボード', sub: 'Webリニューアル · ページ' },
  { id: 'page-gantt', kind: 'page', title: 'ガントチャート', sub: 'Webリニューアル · ページ' },
  { id: 'page-issues', kind: 'page', title: '課題一覧', sub: 'Webリニューアル · ページ' },
];

export const mineRows: readonly PaletteRow[] = [
  {
    id: 'PROJ-131',
    kind: 'issue',
    code: 'PROJ-131',
    title: '画像アップロードのサイズ制限を見直す',
    sub: 'Webリニューアル · 自分',
    marker: { label: '処理中', tone: 'info' },
    tag: { label: 'タスク', tone: 'success' },
  },
  {
    id: 'HELP-56',
    kind: 'issue',
    code: 'HELP-56',
    title: '新入社員アカウント発行フロー',
    sub: '社内ヘルプデスク · 自分',
    marker: { label: '未対応', tone: 'neutral' },
    tag: { label: '運用', tone: 'warning' },
  },
  {
    id: 'MOB-92',
    kind: 'issue',
    code: 'MOB-92',
    title: 'iOS 18 での表示崩れ',
    sub: 'モバイルアプリ v3 · 自分',
    marker: { label: '処理済み', tone: 'success' },
    tag: { label: 'バグ', tone: 'danger' },
  },
];

export const emptyStateSections: readonly PaletteSection[] = [
  { id: 'recent', label: '最近開いた', meta: '学習で並び替え', rows: recentRows },
  { id: 'pages', label: 'Webリニューアル のページ', rows: pageRows },
  { id: 'mine', label: '担当中の課題', meta: '3 件', rows: mineRows },
];

export const freeTextSections: readonly PaletteSection[] = [
  {
    id: 'primary',
    rows: [
      {
        id: 'search',
        kind: 'filter',
        title: '「ログイン」をサイドパネルで検索',
        sub: '課題・Wiki・ドキュメントを全文検索',
        tone: 'accent',
        hint: 'enter',
      },
    ],
  },
  {
    id: 'local',
    rows: [
      {
        id: 'PROJ-123',
        kind: 'issue',
        code: 'PROJ-123',
        title: 'ログイン画面のバリデーション修正',
        sub: 'Webリニューアル · 佐藤 美咲 · 最近開いた',
        marker: { label: '処理中', tone: 'info' },
      },
      {
        id: 'wiki-login',
        kind: 'wiki',
        title: 'ログイン仕様メモ（SSO 移行後）',
        sub: 'Webリニューアル · 最終更新 田中 拓也',
      },
      { id: 'page-login', kind: 'page', title: 'ログイン履歴', sub: 'スペース設定 · ページ' },
      {
        id: 'cmd-switch-user',
        kind: 'command',
        title: 'ログイン中のユーザーを切り替え',
        sub: 'コマンド',
        hint: 'more',
      },
    ],
  },
];

export const issueKeySections: readonly PaletteSection[] = [
  {
    id: 'jump',
    rows: [
      {
        id: 'jump-PROJ-12',
        kind: 'issue',
        code: 'PROJ-12',
        title: 'この課題を直接開く',
        sub: 'nulab / Webリニューアル · 課題キーで移動',
        tone: 'accent',
        hint: 'enter',
      },
    ],
  },
  {
    id: 'prefix',
    label: '前方一致する課題',
    meta: '4 件',
    rows: [
      {
        id: 'PROJ-120',
        kind: 'issue',
        code: 'PROJ-120',
        title: '共通ヘッダーのアクセシビリティ対応',
        sub: 'Webリニューアル · 田中 拓也',
        marker: { label: '処理中', tone: 'info' },
        tag: { label: 'タスク', tone: 'success' },
      },
      {
        id: 'PROJ-121',
        kind: 'issue',
        code: 'PROJ-121',
        title: 'フォーム送信後の二重送信を防ぐ',
        sub: 'Webリニューアル · 佐藤 美咲',
        marker: { label: '未対応', tone: 'neutral' },
        tag: { label: 'バグ', tone: 'danger' },
      },
      {
        id: 'PROJ-128',
        kind: 'issue',
        code: 'PROJ-128',
        title: '検索結果のページングが 2 ページ目で壊れる',
        sub: 'Webリニューアル · 山本 遼',
        marker: { label: '処理済み', tone: 'success' },
        tag: { label: 'バグ', tone: 'danger' },
      },
    ],
  },
];

export const allSpacesSections: readonly PaletteSection[] = [
  {
    id: 'all',
    rows: [
      {
        id: 'HELP-41',
        kind: 'issue',
        code: 'HELP-41',
        title: '請求書テンプレートの差し替え依頼',
        sub: '社内ヘルプデスク · 山本 遼',
        marker: { label: '処理中', tone: 'info' },
        tag: { label: '要望', tone: 'info' },
        avatar: { label: 'nulab' },
        hint: 'enter',
      },
      {
        id: 'PROJ-98',
        kind: 'issue',
        code: 'PROJ-98',
        title: '請求プランの表示を新料金に更新',
        sub: 'Webリニューアル · 田中 拓也',
        marker: { label: '処理済み', tone: 'success' },
        tag: { label: 'タスク', tone: 'success' },
        avatar: { label: 'nulab' },
      },
      {
        id: 'doc-billing',
        kind: 'document',
        title: '受託案件 請求フロー標準手順（2024 改訂）',
        sub: 'ドキュメント · 更新 3 日前',
        avatar: { label: 'acme' },
      },
      {
        id: 'wiki-billing',
        kind: 'wiki',
        title: '請求・支払いフロー（経理向け）',
        sub: '社内ヘルプデスク · 最終更新 山本 遼',
        avatar: { label: 'nulab' },
      },
      {
        id: 'project-billing',
        kind: 'project',
        title: '請求管理',
        sub: 'プロジェクト · 課題 82 件',
        avatar: { label: 'beta' },
      },
    ],
  },
  {
    id: 'disconnected',
    rows: [
      {
        id: 'connect-acme',
        kind: 'connect',
        title: 'acme は未接続 — 接続する',
        sub: '接続すると acme の課題・Wiki も同じ検索に含まれます',
        tone: 'danger',
        hint: 'enter',
      },
    ],
  },
];

export const commandArgSections: readonly PaletteSection[] = [
  {
    id: 'status',
    label: '変更後のステータス',
    meta: 'PROJ-123',
    rows: [
      { id: 'st-1', kind: 'command', title: '未対応', sub: '現在: 処理中' },
      { id: 'st-2', kind: 'command', title: '処理中', sub: '現在のステータス', hint: 'enter' },
      { id: 'st-3', kind: 'command', title: '処理済み', sub: '担当者は 田中 拓也 に戻ります' },
      { id: 'st-4', kind: 'command', title: '完了', sub: '完了理由の選択に進みます', hint: 'more' },
    ],
  },
];

/* ここからサイドパネル（B 群）のダミーデータ */

export const panelFilters: readonly FilterField[] = [
  {
    id: 'space',
    label: 'スペース',
    value: 'nulab',
    neutralValue: 'all',
    options: [
      { id: 'all', label: '全スペース', count: 3 },
      { id: 'nulab', label: 'nulab', count: 17 },
      { id: 'acme', label: 'acme', count: 4 },
      { id: 'beta', label: 'beta', count: 0 },
    ],
  },
  {
    id: 'project',
    label: 'プロジェクト',
    value: 'all',
    neutralValue: 'all',
    options: [
      { id: 'all', label: 'すべて' },
      { id: 'web', label: 'Webリニューアル', count: 12 },
      { id: 'mobile', label: 'モバイルアプリ v3', count: 3 },
      { id: 'help', label: '社内ヘルプデスク', count: 2 },
    ],
  },
  {
    id: 'kind',
    label: '種別',
    value: 'all',
    neutralValue: 'all',
    options: [
      { id: 'all', label: 'すべて', count: 17 },
      { id: 'issue', label: '課題', count: 12 },
      { id: 'wiki', label: 'Wiki', count: 3 },
      { id: 'document', label: 'ドキュメント', count: 2 },
    ],
  },
  {
    id: 'status',
    label: 'ステータス',
    value: 'open',
    neutralValue: 'all',
    options: [
      { id: 'all', label: 'すべて' },
      // 単一選択のままで「未対応か処理中」を表すためのプリセット（§3 D5）
      { id: 'open', label: '完了を除く', count: 9 },
      { id: 'todo', label: '未対応', tone: 'neutral', count: 5 },
      { id: 'doing', label: '処理中', tone: 'info', count: 4 },
      { id: 'done', label: '処理済み', tone: 'success', count: 2 },
      { id: 'closed', label: '完了', tone: 'done', count: 6 },
    ],
  },
  {
    id: 'assignee',
    label: '担当者',
    value: 'all',
    neutralValue: 'all',
    options: [
      { id: 'all', label: 'すべて' },
      { id: 'me', label: '自分', count: 6 },
      { id: 'tanaka', label: '田中 拓也', count: 4 },
      { id: 'sato', label: '佐藤 美咲', count: 3 },
      { id: 'unassigned', label: '未設定', count: 2 },
    ],
  },
  {
    id: 'updated',
    label: '更新日',
    value: 'all',
    neutralValue: 'all',
    options: [
      { id: 'all', label: '指定なし' },
      { id: 'week', label: '1 週間以内', count: 7 },
      { id: 'month', label: '1 か月以内', count: 14 },
      { id: 'quarter', label: '3 か月以内', count: 17 },
    ],
  },
  {
    id: 'target',
    label: 'キーワード対象',
    value: 'subject',
    neutralValue: 'subject',
    options: [
      { id: 'subject', label: '件名' },
      { id: 'body', label: '件名・本文' },
    ],
  },
];

export const panelSpacesReady: readonly SpaceStatus[] = [
  { id: 'nulab', label: 'nulab', state: 'ready', count: 12 },
  { id: 'acme', label: 'acme', state: 'ready', count: 4 },
  { id: 'beta', label: 'beta', state: 'ready', count: 1 },
];

export const panelSpacesEmpty: readonly SpaceStatus[] = [
  { id: 'nulab', label: 'nulab', state: 'ready', count: 0 },
  { id: 'acme', label: 'acme', state: 'ready', count: 0 },
  { id: 'beta', label: 'beta', state: 'ready', count: 0 },
];

export const panelSpacesPartial: readonly SpaceStatus[] = [
  { id: 'nulab', label: 'nulab', state: 'ready', count: 12 },
  { id: 'acme', label: 'acme', state: 'loading' },
  {
    id: 'beta',
    label: 'beta',
    state: 'error',
    message: '認証が切れました',
    action: { label: '再接続', onPress: () => undefined },
  },
];

export const panelTabs: readonly TypeTab[] = [
  { id: 'all', label: 'すべて', count: 17 },
  { id: 'issue', label: '課題', count: 12 },
  { id: 'wiki', label: 'Wiki', count: 3 },
  { id: 'document', label: 'ドキュメント', count: 2 },
];

export const panelSections: readonly PaletteSection[] = [
  {
    id: 'issue',
    label: '課題',
    meta: '12 件',
    rows: [
      {
        id: 'PROJ-142',
        kind: 'issue',
        code: 'PROJ-142',
        title: '決済フローのエラーハンドリング',
        sub: 'Webリニューアル · 田中 拓也 · 2 日前',
        marker: { label: '処理中', tone: 'info' },
        tag: { label: 'バグ', tone: 'danger' },
        avatar: { label: 'nulab' },
        hint: 'enter',
      },
      {
        id: 'PROJ-118',
        kind: 'issue',
        code: 'PROJ-118',
        title: '決済失敗時のリトライ回数を設定できるようにする',
        sub: 'Webリニューアル · 佐藤 美咲 · 5 日前',
        marker: { label: '未対応', tone: 'neutral' },
        tag: { label: '要望', tone: 'info' },
        avatar: { label: 'nulab' },
      },
      {
        id: 'HELP-41',
        kind: 'issue',
        code: 'HELP-41',
        title: '請求書テンプレートの差し替え依頼',
        sub: '社内ヘルプデスク · 山本 遼 · 1 週間前',
        marker: { label: '処理済み', tone: 'success' },
        tag: { label: '運用', tone: 'warning' },
        avatar: { label: 'acme' },
      },
      {
        id: 'MOB-92',
        kind: 'issue',
        code: 'MOB-92',
        title: '決済画面の表示崩れ（iOS 18）',
        sub: 'モバイルアプリ v3 · 自分 · 3 週間前',
        marker: { label: '完了', tone: 'done' },
        tag: { label: 'バグ', tone: 'danger' },
        avatar: { label: 'beta' },
      },
    ],
  },
  {
    id: 'wiki',
    label: 'Wiki',
    meta: '3 件',
    rows: [
      {
        id: 'wiki-payment',
        kind: 'wiki',
        title: '決済まわりの仕様メモ（3D セキュア対応後）',
        sub: 'Webリニューアル · 最終更新 田中 拓也',
        avatar: { label: 'nulab' },
      },
      {
        id: 'wiki-billing',
        kind: 'wiki',
        title: '請求・支払いフロー（経理向け）',
        sub: '社内ヘルプデスク · 最終更新 山本 遼',
        avatar: { label: 'acme' },
      },
    ],
  },
  {
    id: 'document',
    label: 'ドキュメント',
    meta: '2 件',
    rows: [
      {
        id: 'doc-billing',
        kind: 'document',
        title: '受託案件 請求フロー標準手順（2024 改訂）',
        sub: 'ドキュメント · 更新 3 日前',
        avatar: { label: 'acme' },
      },
    ],
  },
];

export const panelPreview: PreviewProps = {
  kind: 'issue',
  code: 'PROJ-142',
  title: '決済フローのエラーハンドリング',
  sub: 'Webリニューアル · 田中 拓也',
  marker: { label: '処理中', tone: 'info' },
  tag: { label: 'バグ', tone: 'danger' },
  avatar: { label: 'nulab' },
  excerpt: [
    {
      text: 'カード会社側のタイムアウトが返ったとき、現在は共通のエラー画面に飛ばしている。ユーザーには ',
    },
    { text: '決済', highlight: true },
    {
      text: 'が成立したかどうかが分からないので、注文番号と再試行の導線を出したい。\n\n再現手順は ',
    },
    { text: '決済', highlight: true },
    { text: 'サンドボックスの 3D セキュア失敗ケースを参照。' },
  ],
  meta: [
    { label: '期限日', value: '2026-09-30' },
    { label: '更新', value: '2 日前' },
    { label: 'マイルストーン', value: 'v2.4 リリース' },
  ],
};

export const panelPreviewWiki: PreviewProps = {
  kind: 'project',
  title: 'Webリニューアル',
  sub: 'nulab · 課題 128 件',
  avatar: { label: 'nulab' },
  bodylessNote: 'プロジェクトは本文を持ちません。↵ で課題一覧を開きます。',
  meta: [{ label: '管理者', value: '田中 拓也' }],
};

/**
 * 提案の並びは PanelSurface が決める（効いている条件を外す提案が先頭）。
 * ここは props の順に依存していないことが分かるよう、意図的に別の順で置く。
 */
export const panelEmptyState: PanelEmptyState = {
  title: '「請求書 テンプレート」に一致する結果がありません',
  description: '絞り込み条件が 2 つ効いています。条件はすべて AND で重なります。',
  suggestions: [
    {
      id: 'scope-space',
      group: 'scope',
      label: 'nulab 全体で検索しなおす',
      sub: '現在は Webリニューアル に絞っています',
    },
    {
      id: 'external',
      group: 'external',
      label: 'Backlog の検索画面で開く',
      sub: '同じ条件を引き継ぎます',
    },
    {
      id: 'drop-status',
      group: 'condition',
      label: 'ステータス「完了を除く」を外す',
      sub: '効いている条件 · 残り 1 条件',
    },
    {
      id: 'scope-all',
      group: 'scope',
      label: '全スペースで検索しなおす',
      sub: '接続済み 3 スペース',
    },
    {
      id: 'drop-target',
      group: 'condition',
      label: 'キーワード対象を「件名・本文」に広げる',
      sub: '現在は件名だけを見ています',
    },
  ],
};
