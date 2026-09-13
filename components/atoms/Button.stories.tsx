import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import { Button } from './Button';

const meta = {
  component: Button,
  args: { onClick: fn() },
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: { variant: 'primary', children: 'Open palette' },
};

export const Secondary: Story = {
  args: { variant: 'secondary', children: 'Cancel' },
};

export const ClickInvokesHandler: Story = {
  name: 'クリックすると onClick が呼ばれる',
  args: { children: 'Open palette' },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole('button', { name: 'Open palette' }));

    await expect(args.onClick).toHaveBeenCalledTimes(1);
  },
};

export const DisabledIgnoresClick: Story = {
  name: '無効なときはクリックしても onClick が呼ばれない',
  args: { children: 'Open palette', disabled: true },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole('button', { name: 'Open palette' }));

    await expect(args.onClick).not.toHaveBeenCalled();
  },
};
