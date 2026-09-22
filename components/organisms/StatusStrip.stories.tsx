import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import { allReady, mixedProgress } from '@/components/fixtures/panel';
import { ja } from '@/components/labels';

import { StatusStrip } from './StatusStrip';

const meta = {
  component: StatusStrip,
  args: { progress: allReady(ja), onProgressAction: fn() },
  decorators: [
    (Story) => (
      <div className="rounded-surface bg-floating px-3 py-2">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof StatusStrip>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AllReady: Story = {
  name: '全部 ready（1 行に畳む）',
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(ja.sections.count(17))).toBeVisible();
  },
};

export const AllLoading: Story = {
  name: '全部 loading（種別に分けず 1 語に畳む）',
  args: {
    progress: [
      { id: 'issue', label: ja.panel.options.issue, state: 'loading' },
      { id: 'wiki', label: ja.panel.options.wiki, state: 'loading' },
      { id: 'document', label: ja.panel.options.document, state: 'loading' },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByText(ja.panel.loading)).toHaveLength(1);
    await expect(canvas.queryByText(ja.panel.options.issue)).toBeNull();
  },
};

export const WithLoading: Story = {
  name: '読み込み中とエラーが混ざる（種別ごとに出す）',
  args: {
    progress: [
      { id: 'issue', label: ja.panel.options.issue, state: 'ready', count: 12 },
      { id: 'wiki', label: ja.panel.options.wiki, state: 'loading' },
      { id: 'document', label: ja.panel.options.document, state: 'ready', count: 2 },
    ],
  },
};

export const WithError: Story = {
  name: 'エラーと再接続ボタン',
  args: { progress: mixedProgress(ja) },
};

export const ReconnectCallsAction: Story = {
  name: '再接続を押すと onProgressAction が呼ばれる',
  args: { progress: mixedProgress(ja) },
  play: async ({ args, canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: ja.panel.reconnect }));

    await expect(args.onProgressAction).toHaveBeenCalledTimes(1);
    await expect(args.onProgressAction).toHaveBeenCalledWith('document');
  },
};
