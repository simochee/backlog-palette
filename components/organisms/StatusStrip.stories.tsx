import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import { spaces } from '@/components/fixtures/domain';
import { allReady, mixedProgress } from '@/components/fixtures/panel';
import { ja } from '@/components/labels';

import { StatusStrip } from './StatusStrip';

const meta = {
  component: StatusStrip,
  args: { spaces: allReady, onSpaceAction: fn() },
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
    await expect(within(canvasElement).getByText(ja.sections.summary(3, 17))).toBeVisible();
  },
};

export const WithLoading: Story = {
  name: '読み込み中を含む',
  args: {
    spaces: [
      { id: spaces.nulab.id, label: spaces.nulab.label, state: 'ready', count: 12 },
      { id: spaces.acme.id, label: spaces.acme.label, state: 'loading' },
      { id: spaces.beta.id, label: spaces.beta.label, state: 'ready', count: 1 },
    ],
  },
};

export const WithError: Story = {
  name: 'エラーと再接続ボタン',
  args: { spaces: mixedProgress(ja) },
};

export const ReconnectCallsAction: Story = {
  name: '再接続を押すと onSpaceAction が呼ばれる',
  args: { spaces: mixedProgress(ja) },
  play: async ({ args, canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: ja.panel.reconnect }));

    await expect(args.onSpaceAction).toHaveBeenCalledTimes(1);
    await expect(args.onSpaceAction).toHaveBeenCalledWith(spaces.beta.id);
  },
};
