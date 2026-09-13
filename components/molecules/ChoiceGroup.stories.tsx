import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import { ChoiceGroup } from './ChoiceGroup';

const themes = [
  { id: 'system', label: 'システムに追従' },
  { id: 'light', label: 'ライト' },
  { id: 'dark', label: 'ダーク' },
];

const meta = {
  component: ChoiceGroup,
  args: { label: '配色', value: 'system', options: themes, onChange: fn() },
} satisfies Meta<typeof ChoiceGroup>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: '3 択（先頭が選択中）',
};

export const Disabled: Story = {
  name: '無効',
  args: { disabled: true },
};

export const ClickCallsOnChange: Story = {
  name: '別の選択肢を押すとその id で onChange が呼ばれる',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole('radio', { name: 'ダーク' }));

    await expect(args.onChange).toHaveBeenCalledWith('dark');
  },
};

export const ArrowKeysMove: Story = {
  name: '→ で次の選択肢に移り、その id で onChange が呼ばれる',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole('radio', { name: 'システムに追従' }));
    await userEvent.keyboard('{ArrowRight}');

    await expect(args.onChange).toHaveBeenCalledWith('light');
  },
};

export const ReadsAsRadioGroup: Story = {
  name: 'ラベル付きの radiogroup として読み上げられ、選択中の 1 つだけが checked',
  args: { value: 'light' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const group = canvas.getByRole('radiogroup', { name: '配色' });
    await expect(within(group).getAllByRole('radio')).toHaveLength(3);
    await expect(canvas.getByRole('radio', { name: 'ライト' })).toBeChecked();
    await expect(canvas.getByRole('radio', { name: 'ダーク' })).not.toBeChecked();
  },
};
