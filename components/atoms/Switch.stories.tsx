import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import { Switch } from './Switch';

const meta = {
  component: Switch,
  args: { onCheckedChange: fn(), 'aria-label': '並び順の学習', checked: false },
} satisfies Meta<typeof Switch>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Off: Story = {
  name: 'オフ',
};

export const On: Story = {
  name: 'オン',
  args: { checked: true },
};

export const Disabled: Story = {
  name: '無効',
  args: { disabled: true },
};

export const ClickTogglesValue: Story = {
  name: 'クリックすると反転した値で onCheckedChange が呼ばれる',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole('switch', { name: '並び順の学習' }));

    await expect(args.onCheckedChange).toHaveBeenCalledWith(true);
  },
};
