import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';

import { projects, spaces } from '@/components/fixtures/domain';
import { ja } from '@/components/labels';

import { PaletteHeader } from './PaletteHeader';

const meta = {
  component: PaletteHeader,
  args: {
    path: [
      { id: 'space', label: spaces.nulab.label, badge: true },
      { id: 'project', label: projects.web.name, badge: true },
    ],
    input: { value: '', placeholder: ja.palette.placeholder },
    escLabel: ja.palette.escClose,
    inputLabel: ja.palette.inputLabel,
    onInputChange: fn(),
  },
  decorators: [
    (Story) => (
      <div className="@container rounded-surface bg-floating">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PaletteHeader>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: '通常',
};

export const Armed: Story = {
  name: '削除待ちの予告つき',
  args: {
    path: [
      { id: 'space', label: spaces.nulab.label, badge: true },
      { id: 'project', label: projects.web.name, badge: true, armed: true },
    ],
    armedNotice: ja.palette.armedNotice,
  },
};

export const EscBack: Story = {
  name: 'esc ラベルが「1 つ前に戻る」',
  args: {
    path: [
      { id: 'space', label: spaces.nulab.label, badge: true },
      { id: 'project', label: projects.web.name, badge: true },
      { id: 'command', label: ja.rows.switchSpace },
    ],
    escLabel: ja.palette.escBack,
  },
};
