import type { Meta, StoryObj } from '@storybook/react-vite';

import { ja } from '@/components/labels';

import { SectionHeader } from './SectionHeader';

const meta = {
  component: SectionHeader,
  args: { id: 'section-recent', label: ja.sections.recent },
} satisfies Meta<typeof SectionHeader>;

export default meta;

type Story = StoryObj<typeof meta>;

export const LabelOnly: Story = {
  name: '見出しだけ',
};

export const WithMeta: Story = {
  name: '補足つき',
  args: { label: ja.sections.results, meta: ja.sections.count(17) },
};
