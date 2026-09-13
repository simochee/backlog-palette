import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, fn, userEvent, within } from 'storybook/test';

import { spaces } from '@/components/fixtures';
import { ja } from '@/components/labels';

import { ConnectSheet } from './ConnectSheet';

const meta = {
  component: ConnectSheet,
  args: { state: { kind: 'idle' }, onSubmit: fn(), onClose: fn() },
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="relative h-screen bg-page">
        <div className="absolute inset-x-0 bottom-6 flex justify-center px-4">
          <Story />
        </div>
      </div>
    ),
  ],
} satisfies Meta<typeof ConnectSheet>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Idle: Story = {
  name: '入力待ち（画面下部中央の横長）',
};

export const Submitting: Story = {
  name: '送信中',
  args: { state: { kind: 'submitting' } },
};

export const ErrorState: Story = {
  name: 'エラー',
  args: { state: { kind: 'error', message: ja.connect.invalidKey } },
};

export const Done: Story = {
  name: '完了',
  args: { state: { kind: 'done', spaceLabel: spaces.nulab.label } },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(ja.connect.doneTitle(spaces.nulab.label))).toBeVisible();

    await userEvent.click(canvas.getByRole('button', { name: ja.connect.close }));
    await expect(args.onClose).toHaveBeenCalledTimes(1);
  },
};

export const EnterSubmits: Story = {
  name: 'Enter で接続が送信される',
  play: async ({ args, canvasElement }) => {
    const input = within(canvasElement).getByLabelText(ja.connect.inputLabel);

    await userEvent.type(input, 'abcdef0123456789{Enter}');

    await expect(args.onSubmit).toHaveBeenCalledTimes(1);
    await expect(args.onSubmit).toHaveBeenCalledWith('abcdef0123456789');
  },
};

export const ComposingEnterDoesNotSubmit: Story = {
  name: '変換中の Enter では送信されない',
  play: async ({ args, canvasElement }) => {
    const input = within(canvasElement).getByLabelText(ja.connect.inputLabel);

    await userEvent.type(input, 'abcdef');
    await fireEvent.keyDown(input, { key: 'Enter', isComposing: true });

    await expect(args.onSubmit).not.toHaveBeenCalled();
  },
};

export const EmptyCannotSubmit: Story = {
  name: '空のまま接続は押せない',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const submit = canvas.getByRole('button', { name: ja.connect.submit });

    await expect(submit).toBeDisabled();
    await userEvent.click(submit);
    await userEvent.type(canvas.getByLabelText(ja.connect.inputLabel), '{Enter}');

    await expect(args.onSubmit).not.toHaveBeenCalled();
  },
};
