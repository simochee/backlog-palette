import type { Meta, StoryObj } from '@storybook/react-vite';

import { Kbd } from './Kbd';

const meta = {
  component: Kbd,
} satisfies Meta<typeof Kbd>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Single: Story = {
  name: '単キー',
  args: { keys: ['↵'] },
};

export const Multiple: Story = {
  name: '複数キー',
  args: { keys: ['⌘', '⇧', 'C'] },
};

export const Dim: Story = {
  name: 'dim',
  args: { keys: ['⇥'], dim: true },
};
