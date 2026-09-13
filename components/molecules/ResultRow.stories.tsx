import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import { ja } from '@/components/labels';
import { longSummary, projects, spaces } from '@/components/fixtures/domain';
import {
  commandRow,
  connectRow,
  descendCommandRow,
  hintRow,
  pageRow,
  projectRow,
  sampleIssues,
  searchRow,
  searchingRow,
} from '@/components/fixtures/rows';

import { ResultRow } from './ResultRow';

const meta = {
  component: ResultRow,
  args: { selected: false, optionId: 'option-1', row: sampleIssues.payment },
  decorators: [
    (Story) => (
      <div role="listbox" aria-label="候補" className="w-full rounded-surface bg-floating py-1">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ResultRow>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Issue: Story = {
  name: '課題（コード + マーカー + タグ + バッジ）',
  args: { row: { ...sampleIssues.payment, space: { label: spaces.nulab.label } } },
};

export const Page: Story = {
  name: 'ページ',
  args: { row: pageRow('board', 'ボード', ja) },
};

export const Project: Story = {
  name: 'プロジェクト（⇥ のヒント）',
  args: { row: projectRow(projects.mobile) },
};

export const Command: Story = {
  name: 'コマンド ›',
  args: { row: descendCommandRow('switch-space', ja.rows.switchSpace) },
};

export const CopyCommand: Story = {
  name: 'コピー系コマンド',
  args: { row: commandRow('copy-key', ja.rows.copyIssueKey, 'PROJ-142') },
};

export const SearchRow: Story = {
  name: '検索行（アクセント）',
  args: { row: searchRow('ログイン', spaces.nulab.label, ja) },
};

export const Connect: Story = {
  name: '未接続（危険色）',
  args: { row: connectRow(spaces.beta.label, ja) },
};

export const Searching: Story = {
  name: '検索中（スピナー）',
  args: { row: searchingRow(ja) },
};

export const LongTitle: Story = {
  name: '長い件名は 1 行で省略され title 属性に全文を持つ',
  args: { row: sampleIssues.invoice },
  play: async ({ canvasElement }) => {
    const title = within(canvasElement).getByTitle(longSummary);
    const style = getComputedStyle(title);

    await expect(title).toHaveTextContent(longSummary);
    await expect(style.whiteSpace).toBe('nowrap');
    await expect(style.textOverflow).toBe('ellipsis');
    await expect(style.overflow).toBe('hidden');
  },
};

export const Selected: Story = {
  name: '選択行は左端の罫とタイトルの太字で示される',
  args: { selected: true },
  play: async ({ canvasElement }) => {
    const option = within(canvasElement).getByRole('option');
    const title = within(option).getByTitle(sampleIssues.payment.title);

    await expect(option).toHaveAttribute('aria-selected', 'true');
    await expect(Number(getComputedStyle(title).fontWeight)).toBeGreaterThanOrEqual(600);
    await expect(getComputedStyle(option, '::before').opacity).toBe('1');
  },
};

export const NoHints: Story = {
  name: 'ヒントが空なら何も描かれない',
  args: { row: hintRow('type', ja.rows.typeHint) },
  play: async ({ canvasElement }) => {
    const option = within(canvasElement).getByRole('option');

    await expect(option.querySelector('kbd')).toBeNull();
  },
};

export const Narrow: Story = {
  name: '幅 360',
  args: { row: { ...sampleIssues.payment, space: { label: spaces.nulab.label } } },
  globals: { width: '360' },
  play: async ({ canvasElement }) => {
    const option = within(canvasElement).getByRole('option');
    const sub = within(option).getByText(sampleIssues.payment.sub ?? '', { exact: false });

    await expect(sub).not.toBeVisible();
  },
};
