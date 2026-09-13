import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import { spaceItems, spaceItemsWithExpired, spaces } from '@/components/fixtures';
import { ja } from '@/components/labels';

import { SpaceList } from './SpaceList';

const meta = {
  component: SpaceList,
  args: { spaces: spaceItems, onReconnect: fn(), onDisconnect: fn() },
  decorators: [
    (Story) => (
      <div className="rounded-surface bg-floating px-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SpaceList>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Three: Story = {
  name: '接続済み 3 件',
};

export const WithExpired: Story = {
  name: '要再接続を含む',
  args: { spaces: spaceItemsWithExpired },
  play: async ({ args, canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole('button', { name: ja.options.reconnect }),
    );

    await expect(args.onReconnect).toHaveBeenCalledTimes(1);
    await expect(args.onReconnect).toHaveBeenCalledWith(spaces.beta.id);
  },
};

export const Empty: Story = {
  name: '0 件の案内',
  args: { spaces: [] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(ja.options.spacesEmpty)).toBeVisible();
  },
};

export const TwoStepDisconnect: Story = {
  name: '削除は 1 回目で確認になり 2 回目で onDisconnect が呼ばれる',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const first = canvas.getByRole('button', {
      name: `${ja.options.disconnect}: ${spaces.acme.label}`,
    });

    await userEvent.click(first);
    await expect(args.onDisconnect).not.toHaveBeenCalled();

    await userEvent.click(
      canvas.getByRole('button', { name: `${ja.options.confirmDisconnect}: ${spaces.acme.label}` }),
    );
    await expect(args.onDisconnect).toHaveBeenCalledTimes(1);
    await expect(args.onDisconnect).toHaveBeenCalledWith(spaces.acme.id);
  },
};
