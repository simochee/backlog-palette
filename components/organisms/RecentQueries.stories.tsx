import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import { recentQueries } from '@/components/fixtures/panel';

import { RecentQueries } from './RecentQueries';

const meta = {
  component: RecentQueries,
  args: { queries: [...recentQueries, '請求書テンプレート', 'オンボーディング'], onPick: fn() },
} satisfies Meta<typeof RecentQueries>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Five: Story = {
  name: '5 件',
};

export const Empty: Story = {
  name: '0 件（描かない）',
  args: { queries: [] },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('button')).toBeNull();
  },
};

export const ClickPicks: Story = {
  name: 'クリックで onPick が呼ばれる',
  play: async ({ args, canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: '決済' }));

    await expect(args.onPick).toHaveBeenCalledExactlyOnceWith('決済');
  },
};
