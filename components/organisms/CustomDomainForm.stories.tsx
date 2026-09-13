import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import { customHosts } from '@/components/fixtures';
import { ja } from '@/components/labels';

import { CustomDomainForm } from './CustomDomainForm';

const meta = {
  component: CustomDomainForm,
  args: { hosts: [], onAdd: fn(), onRemove: fn() },
  decorators: [
    (Story) => (
      <div className="rounded-surface bg-floating p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CustomDomainForm>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  name: '空',
};

export const Typing: Story = {
  name: '入力中',
  args: { initialValue: 'backlog.example' },
};

export const WithHosts: Story = {
  name: '追加済み一覧',
  args: { hosts: customHosts },
};

export const ValidHostIsAdded: Story = {
  name: '正しいホストは追加され入力欄が空に戻る',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText(ja.options.customDomain.inputLabel);

    await userEvent.type(input, 'backlog.example.co.jp{Enter}');

    await expect(args.onAdd).toHaveBeenCalledTimes(1);
    await expect(args.onAdd).toHaveBeenCalledWith('backlog.example.co.jp');
    await expect(input).toHaveValue('');
  },
};

export const InvalidHostIsRejected: Story = {
  name: '不正なホストでは追加できない',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText(ja.options.customDomain.inputLabel);

    await userEvent.type(input, 'https://backlog example{Enter}');

    await expect(canvas.getByRole('alert')).toHaveTextContent(ja.options.customDomain.invalid);
    await expect(canvas.getByRole('button', { name: ja.options.customDomain.add })).toBeDisabled();
    await expect(args.onAdd).not.toHaveBeenCalled();
  },
};
