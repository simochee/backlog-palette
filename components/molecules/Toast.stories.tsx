import type { Meta, StoryObj } from '@storybook/react-vite';

import { ja } from '@/components/labels';

import { Toast } from './Toast';

const meta = {
  component: Toast,
  args: { toast: { message: ja.rows.copied('PROJ-142') } },
} satisfies Meta<typeof Toast>;

export default meta;

type Story = StoryObj<typeof meta>;

export const MessageOnly: Story = {
  name: '文言だけ',
};

export const WithDetail: Story = {
  name: '詳細つき（URL）',
  args: {
    toast: {
      message: ja.rows.copied('検索 URL'),
      detail: 'https://nulab.backlog.com/dashboard#bl-search=eyJ2IjoxLCJxIjoi44Ot44Kw44Kk44OzIn0',
    },
  },
};
