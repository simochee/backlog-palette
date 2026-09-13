import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import { SpaceBadge } from './SpaceBadge';

const meta = {
  component: SpaceBadge,
} satisfies Meta<typeof SpaceBadge>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AsciiKey: Story = {
  name: '英字キー',
  args: { label: 'nulab' },
  play: async ({ canvasElement }) => {
    const badge = within(canvasElement).getByLabelText('nulab');
    await expect(badge).toHaveTextContent('NU');
  },
};

export const WithIcon: Story = {
  name: 'アイコン画像があれば画像',
  args: {
    label: 'ヌーラボ',
    icon: `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><rect width="20" height="20" rx="4" fill="#42ce9f"/><text x="10" y="14" text-anchor="middle" font-size="11" font-family="sans-serif" fill="#fff">N</text></svg>')}`,
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('img', { name: 'ヌーラボ' })).toBeVisible();
  },
};

export const JapaneseLabel: Story = {
  name: '日本語ラベルは頭文字 1 文字',
  args: { label: 'ヌーラボ' },
  play: async ({ canvasElement }) => {
    const badge = within(canvasElement).getByLabelText('ヌーラボ');
    await expect(badge).toHaveTextContent(/^ヌ$/u);
  },
};
