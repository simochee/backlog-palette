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

export const JapaneseLabel: Story = {
  name: '日本語ラベルは頭文字 1 文字',
  args: { label: 'ヌーラボ' },
  play: async ({ canvasElement }) => {
    const badge = within(canvasElement).getByLabelText('ヌーラボ');
    await expect(badge).toHaveTextContent(/^ヌ$/u);
  },
};
