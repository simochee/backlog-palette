import type { Meta, StoryObj } from '@storybook/react-vite';

import { rowKinds } from '@/components/types';

import { KindIcon } from './KindIcon';

const meta = {
  component: KindIcon,
} satisfies Meta<typeof KindIcon>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AllKinds: Story = {
  name: '全 RowKind が並ぶ',
  args: { kind: 'issue' },
  render: () => (
    <ul className="flex flex-wrap gap-3">
      {rowKinds.map((kind) => (
        <li key={kind} className="flex items-center gap-1.5 text-sm text-subtle">
          <KindIcon kind={kind} />
          {kind}
        </li>
      ))}
    </ul>
  ),
};
