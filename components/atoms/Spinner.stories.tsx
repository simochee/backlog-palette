import type { Meta, StoryObj } from '@storybook/react-vite';

import { Spinner } from './Spinner';

const meta = {
  component: Spinner,
} satisfies Meta<typeof Spinner>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: '回転する',
};

export const Labelled: Story = {
  name: 'ラベルつきは status として読まれる',
  args: { label: '検索中' },
};
