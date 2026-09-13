import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor, within } from 'storybook/test';

import { allHintIds, footerHints } from '@/components/fixtures/footer';
import { ja } from '@/components/labels';

import { KeyHints } from './KeyHints';

const meta = {
  component: KeyHints,
  args: { hints: footerHints(allHintIds, ja) },
  decorators: [
    (Story) => (
      <div className="flex h-(--bp-size-footer) items-center rounded-surface bg-floating px-3">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof KeyHints>;

export default meta;

type Story = StoryObj<typeof meta>;

export const All: Story = {
  name: '7 つ全部',
};

export const Overflow: Story = {
  name: '幅が足りないと priority の大きいものから落ち ↵ は必ず残る',
  globals: { width: '360' },
  render: (args) => (
    <div className="w-60">
      <KeyHints {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const visible = () =>
      Array.from(canvasElement.querySelectorAll<HTMLElement>('[data-hint-id]'))
        .filter((element) => element.closest('[aria-hidden="true"]') === null)
        .map((element) => element.dataset.hintId);

    await waitFor(() => expect(visible()).not.toContain('copyUrl'));
    await expect(visible()).toContain('enter');
    await expect(canvas.getAllByText(ja.keys.open)[0]).toBeVisible();
  },
};
