import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, fn, userEvent, within } from 'storybook/test';

import { ja } from '@/components/labels';

import { PaletteInput } from './PaletteInput';

const meta = {
  component: PaletteInput,
  args: {
    value: '',
    placeholder: ja.palette.placeholder,
    onChange: fn(),
    'aria-label': ja.palette.inputLabel,
  },
  decorators: [
    (Story) => (
      <div className="flex h-(--bp-size-header) items-center rounded-surface bg-floating px-3">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PaletteInput>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  name: '空でプレースホルダ',
};

export const Typing: Story = {
  name: '入力中',
  args: { value: 'ぼー' },
};

export const Ghost: Story = {
  name: 'ゴースト補完は入力の続きとして表示され選択できない',
  args: { value: 'ぼー', completion: 'ど' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const ghost = canvas.getByTestId('ghost-completion');
    const input = canvas.getByRole('combobox');

    await expect(ghost).toHaveTextContent('ぼーど');
    await expect(ghost).toHaveAttribute('aria-hidden', 'true');
    await expect(getComputedStyle(ghost).userSelect).toBe('none');
    await expect(getComputedStyle(ghost).pointerEvents).toBe('none');
    await expect(input).toHaveValue('ぼー');
  },
};

export const Composing: Story = {
  name: '変換中（下線つきの未確定文字）',
  args: { value: 'ぼーど' },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole('combobox');

    await fireEvent.compositionStart(input);

    await expect(input).toHaveAttribute('data-composing', 'true');
    await expect(getComputedStyle(input).textDecorationLine).toContain('underline');
  },
};

export const TypingCallsOnChange: Story = {
  name: '文字を打つと onChange に新しい値が渡る',
  play: async ({ args, canvasElement }) => {
    const input = within(canvasElement).getByRole('combobox');

    await userEvent.type(input, 'a');

    await expect(args.onChange).toHaveBeenCalledWith('a');
  },
};
