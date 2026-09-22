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

/** 測定用の不可視の複製を除いた、実際に見えているヒントの id を並び順で返す */
const visibleIds = (canvasElement: HTMLElement) =>
  Array.from(canvasElement.querySelectorAll<HTMLElement>('[data-hint-id]'))
    .filter((element) => element.closest('[aria-hidden="true"]') === null)
    .map((element) => element.dataset.hintId);

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

    await waitFor(() => expect(visibleIds(canvasElement)).not.toContain('copyUrl'));
    await expect(visibleIds(canvasElement)).toContain('enter');
    await expect(canvas.getAllByText(ja.keys.open)[0]).toBeVisible();
  },
};

export const OverflowKeepsOrder: Story = {
  name: '落ちるのは優先順の右側だけで、ラベルの短い下位のヒントが上位を追い越して残らない',
  globals: { width: '360' },
  render: (args) => (
    <div className="w-52">
      <KeyHints {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(visibleIds(canvasElement).length).toBeLessThan(allHintIds.length));
    const visible = visibleIds(canvasElement);
    await expect(visible).toEqual(allHintIds.slice(0, visible.length));
  },
};
