import type { PaletteRow, PaletteSection } from '../palette/PaletteSurface.tsx';
import type { PathSegment } from '../palette/PathStack.tsx';

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
