import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import { Overlay } from './Overlay';

const meta = {
  component: Overlay,
  args: {
    onDismiss: fn(),
    children: (
      <div className="w-full max-w-(--bp-width-palette) rounded-surface bg-floating p-6 shadow-floating">
        内側
      </div>
    ),
  },
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="relative h-screen">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Overlay>;

export default meta;

type Story = StoryObj<typeof meta>;

export const OutsideClickDismisses: Story = {
  name: '暗転部分をクリックすると onDismiss が呼ばれる',
  play: async ({ args, canvasElement }) => {
    await userEvent.click(within(canvasElement).getByTestId('overlay'));

    await expect(args.onDismiss).toHaveBeenCalledTimes(1);
  },
};

export const InsideClickKeeps: Story = {
  name: '内側をクリックしても onDismiss は呼ばれない',
  play: async ({ args, canvasElement }) => {
    await userEvent.click(within(canvasElement).getByText('内側'));

    await expect(args.onDismiss).not.toHaveBeenCalled();
  },
};
