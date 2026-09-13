import type { Meta, StoryObj } from '@storybook/react-vite';
import { type KeyboardEvent, useState } from 'react';
import { expect, fn, isMockFunction, userEvent, within } from 'storybook/test';

import { assignedSection, pagesSection, recentSection } from '@/components/fixtures/sections';
import { ja } from '@/components/labels';
import type { SectionView } from '@/components/types';

import { CandidateList, flattenRows, moveSelection, optionDomId } from './CandidateList';

const sections: SectionView[] = [recentSection(ja), pagesSection(ja), assignedSection(ja)];
const rows = flattenRows(sections);
const first = rows[0]?.id ?? '';
const second = rows[1]?.id ?? '';
const last = rows.at(-1)?.id ?? '';

type HarnessProps = {
  initialSelectedId?: string;
  onSelectionChange: (id: string) => void;
  onAction: (id: string) => void;
};

/** container の代わりに選択状態を持ち、↑↓ を moveSelection に流す */
function Harness({ initialSelectedId, onSelectionChange, onAction }: HarnessProps) {
  const [selectedId, setSelectedId] = useState(initialSelectedId);

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const delta = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : undefined;
    if (delta === undefined) return;
    event.preventDefault();
    const next = moveSelection(sections, selectedId, delta);
    if (next === undefined || next === selectedId) return;
    setSelectedId(next);
    onSelectionChange(next);
  };

  return (
    <div className="rounded-surface bg-floating">
      <input
        aria-label="操作"
        className="w-full px-3 py-2 outline-none"
        onKeyDown={handleKeyDown}
      />
      <CandidateList
        id="candidates"
        sections={sections}
        selectedId={selectedId}
        onAction={onAction}
        aria-label={ja.palette.listLabel}
      />
    </div>
  );
}

const meta = {
  component: CandidateList,
  args: {
    id: 'candidates',
    sections,
    selectedId: first,
    onAction: fn(),
    'aria-label': ja.palette.listLabel,
  },
  decorators: [
    (Story) => (
      <div className="rounded-surface bg-floating">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CandidateList>;

export default meta;

type Story = StoryObj<typeof meta>;
type HarnessStory = StoryObj<HarnessProps>;

export const ThreeSections: Story = {
  name: '3 セクション',
};

export const ArrowDownMoves: HarnessStory = {
  name: '↓ で選択が次の行へ移り末尾で止まる',
  args: { onSelectionChange: fn(), onAction: fn(), initialSelectedId: first },
  render: (args) => <Harness {...args} />,
  play: async ({ args, canvasElement }) => {
    const input = within(canvasElement).getByLabelText('操作');
    await userEvent.click(input);

    await userEvent.keyboard('{ArrowDown}');
    await expect(args.onSelectionChange).toHaveBeenLastCalledWith(second);

    for (let i = 0; i < rows.length; i += 1) await userEvent.keyboard('{ArrowDown}');
    await expect(args.onSelectionChange).toHaveBeenLastCalledWith(last);
    await expect(args.onSelectionChange).toHaveBeenCalledTimes(rows.length - 1);
  },
};

export const ArrowUpStopsAtTop: HarnessStory = {
  name: '↑ は先頭で止まる',
  args: { onSelectionChange: fn(), onAction: fn(), initialSelectedId: second },
  render: (args) => <Harness {...args} />,
  play: async ({ args, canvasElement }) => {
    const input = within(canvasElement).getByLabelText('操作');
    await userEvent.click(input);

    await userEvent.keyboard('{ArrowUp}{ArrowUp}{ArrowUp}');

    await expect(args.onSelectionChange).toHaveBeenCalledTimes(1);
    await expect(args.onSelectionChange).toHaveBeenCalledWith(first);
  },
};

export const HeadersAreNotSelectable: HarnessStory = {
  name: 'セクション見出しは選択の対象にならない',
  args: { onSelectionChange: fn(), onAction: fn(), initialSelectedId: first },
  render: (args) => <Harness {...args} />,
  play: async ({ args, canvasElement }) => {
    const input = within(canvasElement).getByLabelText('操作');
    await userEvent.click(input);

    for (let i = 0; i < rows.length; i += 1) await userEvent.keyboard('{ArrowDown}');

    if (!isMockFunction(args.onSelectionChange)) throw new Error('onSelectionChange は fn()');
    const visited = args.onSelectionChange.mock.calls.map((call) => String(call[0]));
    await expect(visited).toEqual(rows.slice(1).map((row) => row.id));
  },
};

export const ClickActsHoverDoesNot: HarnessStory = {
  name: 'クリックで onAction が呼ばれ、ホバーでは選択が動かない',
  args: { onSelectionChange: fn(), onAction: fn(), initialSelectedId: first },
  render: (args) => <Harness {...args} />,
  play: async ({ args, canvasElement }) => {
    const options = within(canvasElement).getAllByRole('option');
    const target = options[2];
    if (!target) throw new Error('行が足りない');

    await userEvent.hover(target);
    await expect(args.onSelectionChange).not.toHaveBeenCalled();
    await expect(options[0]).toHaveAttribute('aria-selected', 'true');

    await userEvent.click(target);
    await expect(args.onAction).toHaveBeenCalledWith(target.dataset.rowId);
  },
};

export const ActiveDescendantFollows: HarnessStory = {
  name: 'selectedId が変わると aria-activedescendant が追従する',
  args: { onSelectionChange: fn(), onAction: fn(), initialSelectedId: first },
  render: (args) => <Harness {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const listbox = canvas.getByRole('listbox');
    await expect(listbox).toHaveAttribute(
      'aria-activedescendant',
      optionDomId('candidates', first),
    );

    await userEvent.click(canvas.getByLabelText('操作'));
    await userEvent.keyboard('{ArrowDown}');

    await expect(listbox).toHaveAttribute(
      'aria-activedescendant',
      optionDomId('candidates', second),
    );
  },
};
