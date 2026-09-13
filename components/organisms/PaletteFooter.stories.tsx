import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import { footerHints } from '@/components/fixtures/footer';
import { ja } from '@/components/labels';

import { PaletteFooter } from './PaletteFooter';

const meta = {
  component: PaletteFooter,
  args: {
    hints: footerHints(['enter', 'move', 'back', 'take'], ja),
    brand: ja.brand,
  },
  decorators: [
    (Story) => (
      <div className="h-(--bp-size-footer) rounded-surface bg-floating">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PaletteFooter>;

export default meta;

type Story = StoryObj<typeof meta>;

export const HintsOnly: Story = {
  name: 'ヒントのみ',
};

export const WithToast: Story = {
  name: 'トーストつき（ヒントは消えない）',
  args: { toast: { message: ja.rows.copied('PROJ-142') } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole('status')).toHaveTextContent(ja.rows.copied('PROJ-142'));
    await expect(canvas.getAllByText(ja.keys.open)[0]).toBeVisible();
    await expect(canvas.queryByText(ja.brand)).toBeNull();
  },
};
