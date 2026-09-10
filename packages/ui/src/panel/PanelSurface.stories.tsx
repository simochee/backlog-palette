import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import {
  panelEmptyState,
  panelFilters,
  panelPreview,
  panelSections,
  panelSpacesEmpty,
  panelSpacesPartial,
  panelSpacesReady,
  panelTabs,
} from '../fixtures/ja.ts';
import { PanelSurface } from './PanelSurface.tsx';

/**
 * モックのアートボード B1〜B5 に対応する。
 * レイアウトはコンテナ幅で切り替わるので、幅は外側の枠で与える（§5.3）。
 */
const frame =
  (width: number): Decorator =>
  (Story) => (
    <div
      style={{
        width,
        height: 620,
        overflow: 'hidden',
        border: '1px solid var(--bp-border-default)',
        borderRadius: 'var(--bp-radius-surface)',
        boxShadow: 'var(--bp-shadow-surface)',
      }}
    >
      <Story />
    </div>
  );

const meta = {
  title: 'panel/PanelSurface',
  component: PanelSurface,
  parameters: { layout: 'centered' },
  args: {
    defaultValue: '決済',
    filters: panelFilters,
    sections: panelSections,
    spaces: panelSpacesReady,
    selectedId: 'PROJ-142',
    preview: panelPreview,
  },
} satisfies Meta<typeof PanelSurface>;

export default meta;
type Story = StoryObj<typeof meta>;

/** B1: 380px。プレビューは選択行のインライン展開、フィルターは compact */
export const B1_狭い幅: Story = { decorators: [frame(380)] };

/** B2-a: 720px。左リスト + 右プレビュー */
export const B2a_リストとプレビュー: Story = { decorators: [frame(720)] };

/** B2-b: 960px。セクション見出しの代わりに種別タブ */
export const B2b_種別タブ: Story = {
  args: { tabs: panelTabs, selectedTab: 'all' },
  decorators: [frame(960)],
};

/** B3: 読み込み中と認証切れが同時。結果リストの行は動かさない（§3 D6） */
export const B3_逐次描画とエラー: Story = {
  args: { spaces: panelSpacesPartial },
  decorators: [frame(720)],
};

/** B4: 0 件。効いている条件を外す提案が先頭に出る */
export const B4_ゼロ件: Story = {
  args: {
    defaultValue: '請求書 テンプレート',
    sections: [],
    spaces: panelSpacesEmpty,
    emptyState: panelEmptyState,
    preview: undefined,
    selectedId: undefined,
  },
  decorators: [frame(720)],
};

/** B5: 検索 URL のコピー直後。フッターのキーヒントは消さない */
export const B5_コピー直後: Story = {
  args: {
    toast: {
      message: '検索 URL をコピーしました',
      detail: 'https://nulab.backlog.jp/find?q=決済&status=open',
    },
  },
  decorators: [frame(720)],
};
