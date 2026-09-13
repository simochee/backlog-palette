import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';

import {
  hintLabel,
  kindsIn,
  options,
  p1,
  p2,
  p3,
  p4,
  p5,
  panelCallbacks,
  recentQueries,
  spaces,
} from '@/components/fixtures';
import { en, ja, type Labels, LabelsProvider } from '@/components/labels';
import type { PanelView } from '@/components/types';

import { assertPaletteInvariants } from './Palette.invariants';
import { SidePanel } from './SidePanel';
import { StatefulSidePanel } from './SidePanel.harness';

const meta = {
  component: SidePanel,
  args: { ...p1(ja), ...panelCallbacks() },
  render: (args) => <StatefulSidePanel {...args} />,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="h-screen">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SidePanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const P1: Story = {
  name: 'P1 初期（前回の語と最近の検索） — 入力欄が空で ↑ を押すと onInputChange に直前の語が渡る',
  args: p1(ja),
  play: async ({ args, canvasElement }) => {
    await userEvent.keyboard('{ArrowUp}');
    await expect(args.onInputChange).toHaveBeenLastCalledWith(recentQueries[0]);

    await assertPaletteInvariants({ canvasElement, view: args, spies: args });
  },
};

export const P2: Story = {
  name: 'P2 結果あり（幅 380、compact） — 行にスペースバッジが出る／⇥ は補完だけで積む行が無い',
  args: p2(ja),
  decorators: [
    (Story) => (
      <div className="h-screen" style={{ width: 380 }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByLabelText(spaces.nulab.label).length).toBeGreaterThan(0);
    const hints = args.sections.flatMap((section) => section.rows.flatMap((row) => row.hints));
    await expect(hints).not.toContain('stack');
    await expect(hintLabel(canvasElement, 'take')).toContain(ja.keys.complete);
    await expect(canvas.getByRole('region', { name: ja.panel.title })).toHaveAttribute(
      'data-compact',
      'true',
    );

    await assertPaletteInvariants({ canvasElement, view: args, spies: args });
  },
};

export const P3: Story = {
  name: 'P3 スペース単位の逐次到着 — ステータス帯に読み込み中とエラーが並び、結果の行は動かない',
  args: p3(ja),
  play: async ({ args, canvasElement }) => {
    const strip = within(canvasElement).getByLabelText(ja.panel.statusLabel);
    await expect(within(strip).getByText(ja.panel.loading)).toBeVisible();
    await expect(within(strip).getByText(ja.panel.authExpired)).toBeVisible();
    await expect(within(strip).getByRole('button', { name: ja.panel.reconnect })).toBeVisible();

    const rows = options(canvasElement);
    await expect(rows[0]?.dataset.rowId).toBe(args.sections[0]?.rows[0]?.id);
    await expect(rows).toHaveLength(args.sections[0]?.rows.length ?? 0);

    await assertPaletteInvariants({ canvasElement, view: args, spies: args });
  },
};

export const P4: Story = {
  name: 'P4 0 件 — 条件を外す提案が先頭 → スコープ → 本体検索',
  args: p4(ja),
  play: async ({ args, canvasElement }) => {
    await expect(kindsIn(canvasElement)).toEqual(['hint', 'command', 'search', 'external']);
    await expect(options(canvasElement)[1]).toHaveAttribute('aria-selected', 'true');

    await assertPaletteInvariants({ canvasElement, view: args, spies: args });
  },
};

export const P5: Story = {
  name: 'P5 フィルター変更直後 — onFilterChange が呼ばれ、結果は検索中の表示になる',
  args: p5(ja),
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole('button', { name: new RegExp(ja.panel.fields.assignee, 'u') }),
    );
    const group = await within(document.body).findByRole('radiogroup', {
      name: ja.panel.fields.assignee,
    });
    await userEvent.click(within(group).getByRole('radio', { name: ja.panel.options.me }));

    await expect(args.onFilterChange).toHaveBeenCalledTimes(1);
    await expect(args.onFilterChange).toHaveBeenCalledWith('assignee', 'me');
    await expect(options(canvasElement)[0]?.dataset.rowId).toBe('searching');

    await assertPaletteInvariants({ canvasElement, view: args, spies: args });
  },
};

function Cell({
  theme,
  labels,
  width,
  view,
}: {
  theme: 'light' | 'dark';
  labels: Labels;
  width: number;
  view: PanelView;
}) {
  return (
    <div
      data-color-scheme={theme}
      className="h-160 shrink-0 overflow-hidden rounded-surface border border-border"
      style={{ width }}
    >
      <LabelsProvider labels={labels}>
        <SidePanel {...view} {...panelCallbacks()} labels={labels} />
      </LabelsProvider>
    </div>
  );
}

export const Matrix: Story = {
  name: '両テーマ・両言語・幅 360/640/720 で描画が落ちない',
  parameters: { layout: 'padded' },
  decorators: [(Story) => <Story />],
  render: () => (
    <div className="flex flex-col gap-4">
      {(['light', 'dark'] as const).map((theme) =>
        ([ja, en] as const).map((labels) => (
          <div key={`${theme}-${labels.panel.title}`} className="flex flex-wrap gap-4">
            {[360, 640, 720].map((width) => (
              <Cell key={width} theme={theme} labels={labels} width={width} view={p3(labels)} />
            ))}
          </div>
        )),
      )}
    </div>
  ),
};
