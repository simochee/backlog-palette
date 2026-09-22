import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';

import {
  options,
  paletteCallbacks,
  s1,
  s1Empty,
  s1Failed,
  s1Loading,
  sectionIds,
} from '@/components/fixtures';
import { ja } from '@/components/labels';

import { Palette } from './Palette';
import { StatefulPalette } from './Palette.harness';
import { assertPaletteInvariants } from './Palette.invariants';

/** 何も打っていないときに並ぶもの（palette.md §9）。API を待つのは担当課題だけ */
const meta = {
  title: 'organisms/Palette/empty',
  component: Palette,
  args: { ...s1(ja), ...paletteCallbacks() },
  render: (args) => <StatefulPalette {...args} />,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="relative h-screen">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Palette>;

export default meta;

type Story = StoryObj<typeof meta>;

export const S1: Story = {
  name: 'S1 空状態（履歴あり） — 最近開いた → この課題 → ページ → 担当中 の順に並び先頭行が選択されている',
  args: s1(ja),
  play: async ({ args, canvasElement }) => {
    await expect(sectionIds(canvasElement)).toEqual(['recent', 'issue', 'pages', 'assigned']);
    await expect(options(canvasElement)[0]).toHaveAttribute('aria-selected', 'true');

    await assertPaletteInvariants({ canvasElement, view: args, spies: args });
  },
};

export const S1Empty: Story = {
  name: "S1' 空状態（履歴なし） — 案内行はページの下にあり、ヒントも選択も持たない",
  args: s1Empty(ja),
  play: async ({ args, canvasElement }) => {
    const rows = options(canvasElement);
    const hint = rows.at(-1);
    await expect(rows[0]?.dataset.kind).toBe('page');
    await expect(rows[0]).toHaveAttribute('aria-selected', 'true');
    await expect(hint?.dataset.kind).toBe('hint');
    await expect(hint?.querySelector('kbd')).toBeNull();
    await expect(hint).toHaveAttribute('aria-selected', 'false');
    await expect(sectionIds(canvasElement)).toContain('pages');

    await assertPaletteInvariants({ canvasElement, view: args, spies: args });
  },
};

export const S1Loading: Story = {
  name: "S1'' 担当課題が届く前 — 見出しと読み込み中の行が先に出て、選択はそこへ行かない",
  args: s1Loading(ja),
  play: async ({ args, canvasElement }) => {
    const loading = options(canvasElement).at(-1);
    await expect(loading?.dataset.rowId).toBe('assigned:loading');
    await expect(loading?.querySelector('kbd')).toBeNull();
    await expect(loading).toHaveAttribute('aria-selected', 'false');
    await expect(sectionIds(canvasElement)).toContain('assigned');

    await assertPaletteInvariants({ canvasElement, view: args, spies: args });
  },
};

export const S1Failed: Story = {
  name: "S1''' 担当課題が取れなかった — 読み込み中のままにせず、再接続の行になる",
  args: s1Failed(ja),
  play: async ({ args, canvasElement }) => {
    const status = options(canvasElement).at(-1);
    await expect(status?.dataset.kind).toBe('status');
    await expect(status?.dataset.tone).toBe('danger');
    await expect(sectionIds(canvasElement)).toContain('assigned');

    await assertPaletteInvariants({ canvasElement, view: args, spies: args });
  },
};
