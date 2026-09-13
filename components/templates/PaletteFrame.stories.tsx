import type { Meta, StoryObj } from '@storybook/react-vite';

import { ja } from '@/components/labels';

import { PaletteFrame } from './PaletteFrame';

const meta = {
  component: PaletteFrame,
  args: {
    'aria-label': ja.brand,
    header: <div className="flex h-(--bp-size-header) items-center px-3 text-subtle">ヘッダー</div>,
    list: <div className="px-3 py-2 text-subtle">リスト</div>,
    footer: <div className="flex h-full items-center px-3 text-xs text-subtle">フッター</div>,
  },
} satisfies Meta<typeof PaletteFrame>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Layout: Story = {
  name: 'ヘッダー／リスト／フッターが縦に並ぶ',
};

export const EmptyList: Story = {
  name: '0 行のときは 1 行分の高さに縮む',
  args: { list: null },
};
