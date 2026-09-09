import type { PaletteSection } from '@backlog-palette/ui';

/**
 * M0 スパイク用の仮データ。
 *
 * 空状態は表示キャッシュから描くのが本実装（§9）。ここは iframe の表示と
 * フォーカス移譲を確認するための足場なので、M2 で丸ごと消える。
 */
export const emptyStateSections: readonly PaletteSection[] = [
  {
    id: 'spike',
    label: 'M0 スパイク',
    meta: '仮データ',
    rows: [
      {
        id: 'focus',
        kind: 'command',
        title: '入力欄にフォーカスが当たっていれば #18-7 は解決',
        sub: '↑↓ で選択が動き、Esc で閉じることを確認する',
        hint: 'enter',
      },
      {
        id: 'ime',
        kind: 'issue',
        code: 'PROJ-123',
        title: '日本語を入力して変換中の Enter で閉じないことを確認する',
        sub: 'Webリニューアル · 変換確定の Enter は遷移に使わない',
        marker: { label: '処理中', tone: 'info' },
        tag: { label: 'バグ', tone: 'danger' },
      },
      {
        id: 'isolation',
        kind: 'page',
        title: 'ページ側の j / k がこの入力を奪わないことを確認する',
        sub: 'キー入力は iframe に閉じる',
      },
    ],
  },
];
