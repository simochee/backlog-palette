import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import { Button } from './Button';

const meta = {
  component: Button,
  args: { onClick: fn(), children: '接続' },
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  name: 'primary',
  args: { variant: 'primary' },
};

export const Secondary: Story = {
  name: 'secondary',
  args: { variant: 'secondary' },
};

export const Ghost: Story = {
  name: 'ghost',
  args: { variant: 'ghost' },
};

export const Danger: Story = {
  name: 'tone が danger',
  args: { tone: 'danger', children: '削除' },
  render: (args) => (
    <div className="flex gap-2">
      <Button {...args} variant="primary" />
      <Button {...args} variant="secondary" />
      <Button {...args} variant="ghost" />
    </div>
  ),
};

export const Busy: Story = {
  name: 'busy のときはスピナーが出て押せない',
  args: { busy: true, children: '接続中…' },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole('button', { name: '接続中…' }));

    await expect(args.onClick).not.toHaveBeenCalled();
  },
};

export const ClickInvokesHandler: Story = {
  name: 'クリックすると onClick が呼ばれる',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole('button', { name: '接続' }));

    await expect(args.onClick).toHaveBeenCalledTimes(1);
  },
};

export const DisabledIgnoresClick: Story = {
  name: '無効なときはクリックしても onClick が呼ばれない',
  args: { disabled: true },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole('button', { name: '接続' }));

    await expect(args.onClick).not.toHaveBeenCalled();
  },
};
