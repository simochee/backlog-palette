import type { Meta, StoryObj } from '@storybook/react-vite';

import { tones } from '@/components/types';

import { Badge } from './Badge';

const meta = {
  component: Badge,
} satisfies Meta<typeof Badge>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AllTones: Story = {
  name: '6 つの tone が並ぶ',
  args: { label: '処理中', tone: 'info' },
  render: () => (
    <div className="flex flex-wrap gap-2">
      {tones.map((tone) => (
        <Badge key={tone} label={tone} tone={tone} />
      ))}
    </div>
  ),
};

export const WithDot: Story = {
  name: 'dot つき',
  args: { label: '処理中', tone: 'info', dot: true },
};
