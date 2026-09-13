import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor, within } from 'storybook/test';

import { ja } from '@/components/labels';

import { PanelLayout } from './PanelLayout';

const slot = (text: string) => <div className="text-sm text-subtle">{text}</div>;

const meta = {
  component: PanelLayout,
  args: {
    'aria-label': '詳細検索',
    input: slot('入力'),
    recent: slot('最近の検索'),
    filters: slot('フィルターバー'),
    status: slot('ステータス帯'),
    list: slot('結果'),
    footer: <div className="flex h-full items-center px-3 text-xs text-subtle">{ja.brand}</div>,
  },
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="h-screen">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PanelLayout>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Wide: Story = {
  name: '縦積みの配置',
};

export const Compact: Story = {
  name: '幅 480px 未満で compact を伝える',
  globals: { width: '360' },
  play: async ({ canvasElement }) => {
    const region = within(canvasElement).getByRole('region', { name: '詳細検索' });
    await waitFor(() => expect(region).toHaveAttribute('data-compact', 'true'));
  },
};
