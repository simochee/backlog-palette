import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import { projects, spaces } from '@/components/fixtures/domain';
import {
  s0,
  s1,
  s1Empty,
  s2,
  s3,
  s4,
  s5,
  s6,
  s7,
  s8,
  s9,
  s10,
  s11,
  s12,
  s13,
} from '@/components/fixtures/palette';
import { en, ja, type Labels, LabelsProvider } from '@/components/labels';
import { flattenRows } from '@/components/organisms/CandidateList';
import type { PaletteView } from '@/components/types';

import { Palette } from './Palette';
import { StatefulPalette } from './Palette.harness';
import { assertPaletteInvariants } from './Palette.invariants';

const callbacks = () => ({
  onInputChange: fn(),
  onSelectionChange: fn(),
  onAction: fn(),
  onTake: fn(),
  onBackspaceAtStart: fn(),
  onEscape: fn(),
  onCopySearchUrl: fn(),
  onOpenPanel: fn(),
  onDismiss: fn(),
});

const meta = {
  component: Palette,
  args: { ...s1(ja), ...callbacks() },
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

const options = (canvasElement: HTMLElement) => within(canvasElement).getAllByRole('option');
const groups = (canvasElement: HTMLElement) =>
  Array.from(canvasElement.querySelectorAll<HTMLElement>('[role="group"]'));
const hintLabel = (canvasElement: HTMLElement, id: string) =>
  canvasElement.querySelector(`[data-hint-id="${id}"]:not([aria-hidden="true"] *)`)?.textContent ??
  '';

export const S0: Story = {
  name: 'S0 未接続で何も出せない — 接続行が 1 つだけあり選択されている',
  args: s0(ja),
  play: async ({ args, canvasElement }) => {
    await assertPaletteInvariants({ canvasElement, view: args, spies: args });

    const rows = options(canvasElement);
    await expect(rows).toHaveLength(1);
    await expect(rows[0]).toHaveAttribute('data-kind', 'connect');
    await expect(rows[0]).toHaveAttribute('aria-selected', 'true');
  },
};

export const S1: Story = {
  name: 'S1 空状態（履歴あり） — 3 セクションが順に並び先頭行が選択されている',
  args: s1(ja),
  play: async ({ args, canvasElement }) => {
    await assertPaletteInvariants({ canvasElement, view: args, spies: args });

    const ids = groups(canvasElement).map((group) => group.dataset.sectionId);
    await expect(ids).toEqual(['recent', 'pages', 'assigned']);
    await expect(options(canvasElement)[0]).toHaveAttribute('aria-selected', 'true');
  },
};

export const S1Empty: Story = {
  name: "S1' 空状態（履歴なし） — 案内行にはヒントが無く、ページのセクションは出る",
  args: s1Empty(ja),
  play: async ({ args, canvasElement }) => {
    await assertPaletteInvariants({ canvasElement, view: args, spies: args });

    const [hint] = options(canvasElement);
    await expect(hint).toHaveAttribute('data-kind', 'hint');
    await expect(hint?.querySelector('kbd')).toBeNull();
    await expect(groups(canvasElement).map((group) => group.dataset.sectionId)).toContain('pages');
  },
};

export const S2: Story = {
  name: 'S2 ページ名を入力中 — ゴースト補完が出て Tab で onTake が呼ばれる／フッターの ⇥ ラベルが「補完」',
  args: s2(ja),
  play: async ({ args, canvasElement }) => {
    await assertPaletteInvariants({ canvasElement, view: args, spies: args });

    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('ghost-completion')).toHaveTextContent('がんとチャート');
    await expect(hintLabel(canvasElement, 'take')).toContain(ja.keys.complete);
    await expect(groups(canvasElement).map((group) => group.dataset.sectionId)).toEqual([
      'pages',
      'search',
    ]);

    await userEvent.keyboard('{Tab}');
    await expect(args.onTake).toHaveBeenLastCalledWith('page:gantt');
  },
};

export const S3: Story = {
  name: 'S3 課題キーを入力中 — 直接ジャンプ行が先頭で選択されアクセント面を持つ／⌘↵ で newTab: true',
  args: s3(ja),
  play: async ({ args, canvasElement }) => {
    await assertPaletteInvariants({ canvasElement, view: args, spies: args });

    const [direct] = options(canvasElement);
    await expect(direct).toHaveAttribute('data-row-id', 'direct:PROJ-12');
    await expect(direct).toHaveAttribute('data-tone', 'accent');
    await expect(direct).toHaveAttribute('aria-selected', 'true');
  },
};

export const S4: Story = {
  name: 'S4 自由テキスト — 検索行が先頭／強い一致がある入力では候補が先頭で検索行が 2 番目',
  args: s4(ja),
  play: async ({ args, canvasElement }) => {
    await assertPaletteInvariants({ canvasElement, view: args, spies: args });

    await expect(options(canvasElement)[0]).toHaveAttribute('data-kind', 'search');
    await expect(hintLabel(canvasElement, 'enter')).toContain(ja.keys.search);
  },
};

export const S5: Story = {
  name: 'S5 検索中 — 検索行の直下に検索中の行があり選択されている／見出しの補足に進捗が出る',
  args: s5(ja),
  play: async ({ args, canvasElement }) => {
    await assertPaletteInvariants({ canvasElement, view: args, spies: args });

    const [search, searching] = options(canvasElement);
    await expect(search).toHaveAttribute('data-kind', 'search');
    await expect(searching).toHaveAttribute('data-row-id', 'searching');
    await expect(searching).toHaveAttribute('aria-selected', 'true');
    await expect(within(canvasElement).getByText(ja.sections.loading(spaces.nulab.label))).toBeVisible();
  },
};

export const S6: Story = {
  name: 'S6 検索結果あり（全スペース） — 行にスペースバッジが出る／保留通知行の Enter で onAction が呼ばれる',
  args: s6(ja),
  play: async ({ args, canvasElement }) => {
    await assertPaletteInvariants({ canvasElement, view: args, spies: args });

    const canvas = within(canvasElement);
    await expect(canvas.getAllByLabelText(spaces.nulab.label).length).toBeGreaterThan(0);
    await expect(canvas.getAllByLabelText(spaces.acme.label).length).toBeGreaterThan(0);

    const rows = flattenRows(args.sections);
    for (let index = 0; index < rows.length; index += 1) await userEvent.keyboard('{ArrowUp}');
    args.onAction.mockClear();
    await userEvent.keyboard('{Enter}');
    await expect(args.onAction).toHaveBeenCalledExactlyOnceWith('notice', { newTab: false });
  },
};

export const S7: Story = {
  name: 'S7 検索 0 件 — 案内行 → 広げる提案（アクセント）→ 本体検索 の順',
  args: s7(ja),
  play: async ({ args, canvasElement }) => {
    await assertPaletteInvariants({ canvasElement, view: args, spies: args });

    const results = groups(canvasElement).find((group) => group.dataset.sectionId === 'results');
    const kinds = Array.from(results?.querySelectorAll('[role="option"]') ?? []).map(
      (option) => option.getAttribute('data-kind'),
    );
    await expect(kinds).toEqual(['hint', 'search', 'panel', 'external']);
    await expect(results?.querySelectorAll('[role="option"]')[1]).toHaveAttribute(
      'data-tone',
      'accent',
    );
  },
};

export const S8: Story = {
  name: 'S8 スコープ削除待ち — 右端の段が取り消し線／予告が出る／フッターの ⌫ ラベルが変わる',
  args: s8(ja),
  play: async ({ args, canvasElement }) => {
    await assertPaletteInvariants({ canvasElement, view: args, spies: args });

    const canvas = within(canvasElement);
    const segment = canvas.getByText(projects.web.name);
    await expect(getComputedStyle(segment).textDecorationLine).toContain('line-through');
    await expect(canvas.getByText(ja.palette.armedNotice)).toBeVisible();
    await expect(hintLabel(canvasElement, 'back')).toContain(ja.keys.backArmed(projects.web.name));
  },
};

export const S9: Story = {
  name: 'S9 コマンド階層 — 引数の行だけが並ぶ／esc ラベルが「1 つ前に戻る」／Esc で onEscape',
  args: s9(ja),
  play: async ({ args, canvasElement }) => {
    await assertPaletteInvariants({ canvasElement, view: args, spies: args });

    const kinds = options(canvasElement).map((option) => option.getAttribute('data-kind'));
    await expect(kinds).toEqual(['space', 'space', 'space']);
    await expect(within(canvasElement).getByText(ja.palette.escBack)).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');
    await expect(args.onEscape).toHaveBeenCalledTimes(1);
  },
};

export const S10: Story = {
  name: 'S10 未接続スペースがある全スペース検索 — 末尾に接続行が 1 つ。バナーは無い',
  args: s10(ja),
  play: async ({ args, canvasElement }) => {
    await assertPaletteInvariants({ canvasElement, view: args, spies: args });

    const results = groups(canvasElement).find((group) => group.dataset.sectionId === 'results');
    const kinds = Array.from(results?.querySelectorAll('[role="option"]') ?? []).map(
      (option) => option.getAttribute('data-kind'),
    );
    await expect(kinds.at(-1)).toBe('connect');
    await expect(kinds.filter((kind) => kind === 'connect')).toHaveLength(1);
    await expect(within(canvasElement).queryByRole('alert')).toBeNull();
  },
};

export const S11: Story = {
  name: 'S11 一部スペースが認証切れ — 末尾に再接続行。他の結果は出ている',
  args: s11(ja),
  play: async ({ args, canvasElement }) => {
    await assertPaletteInvariants({ canvasElement, view: args, spies: args });

    const results = groups(canvasElement).find((group) => group.dataset.sectionId === 'results');
    const kinds = Array.from(results?.querySelectorAll('[role="option"]') ?? []).map(
      (option) => option.getAttribute('data-kind'),
    );
    await expect(kinds.at(-1)).toBe('status');
    await expect(kinds.filter((kind) => kind === 'issue').length).toBeGreaterThan(0);
  },
};

export const S12: Story = {
  name: 'S12 コピー直後 — フッター右端にトースト、ヒントは消えない',
  args: s12(ja),
  play: async ({ args, canvasElement }) => {
    await assertPaletteInvariants({ canvasElement, view: args, spies: args });

    const canvas = within(canvasElement);
    await expect(canvas.getByRole('status')).toHaveTextContent(ja.rows.copied('PROJ-142'));
    await expect(hintLabel(canvasElement, 'enter')).toContain(ja.keys.open);
  },
};

export const S13: Story = {
  name: 'S13 #もば でプロジェクト行を選択中 — フッターの ⇥ ラベルが「スコープに積む」／Tab で onTake、Enter で onAction',
  args: s13(ja),
  play: async ({ args, canvasElement }) => {
    await assertPaletteInvariants({ canvasElement, view: args, spies: args });

    await expect(hintLabel(canvasElement, 'take')).toContain(ja.keys.stack);

    args.onTake.mockClear();
    args.onAction.mockClear();
    await userEvent.keyboard('{Tab}');
    await expect(args.onTake).toHaveBeenCalledExactlyOnceWith(`project:${projects.mobile.key}`);
    await userEvent.keyboard('{Enter}');
    await expect(args.onAction).toHaveBeenCalledExactlyOnceWith(`project:${projects.mobile.key}`, {
      newTab: false,
    });
  },
};

export const Narrow: Story = {
  name: '狭い幅（360） — ↵ が残り、補足が隠れ、パスがバッジだけになる',
  args: { ...s6(ja), path: s1(ja).path, width: 360 },
  globals: { width: '360' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(hintLabel(canvasElement, 'enter')).toContain(ja.keys.open);
    const [firstOption] = options(canvasElement).filter(
      (option) => option.getAttribute('data-kind') === 'issue',
    );
    const sub = firstOption?.querySelector('.truncate.\\@max-narrow\\:hidden');
    await expect(sub).not.toBeVisible();
    await expect(canvas.getByText(spaces.nulab.label)).not.toBeVisible();
  },
};

export const DarkS1: Story = {
  name: 'ダーク — S1',
  args: s1(ja),
  globals: { theme: 'dark' },
};

export const DarkS6: Story = {
  name: 'ダーク — S6',
  args: s6(ja),
  globals: { theme: 'dark' },
};

export const EnglishS1: Story = {
  name: 'English — S1',
  args: { ...s1(en), labels: en },
  globals: { locale: 'en' },
};

export const EnglishS6: Story = {
  name: 'English — S6（ラベル長の違いでフッターが溢れないこと）',
  args: { ...s6(en), labels: en },
  globals: { locale: 'en' },
  play: async ({ canvasElement }) => {
    await expect(hintLabel(canvasElement, 'enter')).toContain(en.keys.open);
    await expect(hintLabel(canvasElement, 'copyUrl')).toContain(en.keys.copyUrl);
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
  view: PaletteView;
}) {
  return (
    <div
      data-color-scheme={theme}
      className="@container relative h-160 shrink-0 overflow-hidden rounded-surface bg-page"
      style={{ width }}
    >
      <LabelsProvider labels={labels}>
        <Palette {...view} {...callbacks()} labels={labels} width={width} />
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
          <div key={`${theme}-${labels.palette.escClose}`} className="flex flex-wrap gap-4">
            {[360, 640, 720].map((width) => (
              <Cell key={width} theme={theme} labels={labels} width={width} view={s6(labels)} />
            ))}
          </div>
        )),
      )}
    </div>
  ),
};
