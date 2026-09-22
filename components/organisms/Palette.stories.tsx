import type { Meta, StoryObj } from '@storybook/react-vite';
import { useRef } from 'react';
import { expect, userEvent, within } from 'storybook/test';

import {
  groups,
  hintLabel,
  kindsIn,
  options,
  paletteCallbacks,
  projects,
  resultsGroup,
  s0,
  s1,
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
  sectionIds,
} from '@/components/fixtures';
import { ja } from '@/components/labels';
import { flattenRows } from '@/components/organisms/CandidateList';
import type { FocusHandle } from '@/components/types';

import { Palette, type PaletteProps } from './Palette';
import { StatefulPalette } from './Palette.harness';
import { assertPaletteInvariants } from './Palette.invariants';

const meta = {
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

export const S0: Story = {
  name: 'S0 未接続で何も出せない — 接続行が 1 つだけあり選択されている',
  args: s0(ja),
  play: async ({ args, canvasElement }) => {
    const rows = options(canvasElement);
    await expect(rows).toHaveLength(1);
    await expect(rows[0]?.dataset.kind).toBe('connect');
    await expect(rows[0]).toHaveAttribute('aria-selected', 'true');

    await assertPaletteInvariants({ canvasElement, view: args, spies: args });
  },
};

export const S2: Story = {
  name: 'S2 ページ名を入力中 — ゴースト補完が出て Tab で onTake が呼ばれる／フッターの ⇥ ラベルが「補完」',
  args: s2(ja),
  play: async ({ args, canvasElement }) => {
    await expect(within(canvasElement).getByTestId('ghost-completion')).toHaveTextContent(
      'がんとチャート',
    );
    await expect(hintLabel(canvasElement, 'take')).toContain(ja.keys.complete);
    await expect(sectionIds(canvasElement)).toEqual(['pages', 'search']);

    await userEvent.keyboard('{Tab}');
    await expect(args.onTake).toHaveBeenLastCalledWith('page:gantt');

    await assertPaletteInvariants({ canvasElement, view: args, spies: args });
  },
};

export const S3: Story = {
  name: 'S3 課題キーを入力中 — 直接ジャンプ行が先頭で選択されアクセント面を持つ／⌘↵ で newTab: true',
  args: s3(ja),
  play: async ({ args, canvasElement }) => {
    const [direct] = options(canvasElement);
    await expect(direct?.dataset.rowId).toBe('direct:PROJ-12');
    await expect(direct?.dataset.tone).toBe('accent');
    await expect(direct).toHaveAttribute('aria-selected', 'true');

    await assertPaletteInvariants({ canvasElement, view: args, spies: args });
  },
};

export const S4: Story = {
  name: 'S4 自由テキスト — 検索行が先頭／強い一致がある入力では候補が先頭で検索行が 2 番目',
  args: s4(ja),
  play: async ({ args, canvasElement }) => {
    await expect(options(canvasElement)[0]?.dataset.kind).toBe('search');
    await expect(hintLabel(canvasElement, 'enter')).toContain(ja.keys.search);

    await assertPaletteInvariants({ canvasElement, view: args, spies: args });
  },
};

export const S5: Story = {
  name: 'S5 検索中 — 検索行の直下に検索中の行があり選択されている／見出しは何も言わない',
  args: s5(ja),
  play: async ({ args, canvasElement }) => {
    const [search, searching] = options(canvasElement);
    await expect(search?.dataset.kind).toBe('search');
    await expect(searching?.dataset.rowId).toBe('searching');
    await expect(searching).toHaveAttribute('aria-selected', 'true');
    // 「検索中」は検索行の補足と行の 2 か所。見出しでもう一度言わない（D-49）
    await expect(
      within(canvasElement).queryByText(new RegExp(`^${ja.panel.options.issue} `, 'u')),
    ).toBeNull();

    await assertPaletteInvariants({ canvasElement, view: args, spies: args });
  },
};

export const S6: Story = {
  name: 'S6 検索結果あり — 見出しの補足に種別ごとの件数／保留通知行の Enter で onAction が呼ばれる',
  args: s6(ja),
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(`${ja.panel.options.issue} 12`, { exact: false })).toBeVisible();

    const rows = flattenRows(args.sections);
    const noticeIndex = rows.findIndex((row) => row.id === 'notice');
    for (let index = 0; index < rows.length; index += 1) await userEvent.keyboard('{ArrowUp}');
    for (let index = 0; index < noticeIndex; index += 1) await userEvent.keyboard('{ArrowDown}');
    args.onAction.mockClear();
    await userEvent.keyboard('{Enter}');
    await expect(args.onAction).toHaveBeenCalledTimes(1);
    await expect(args.onAction).toHaveBeenCalledWith('notice', { newTab: false });

    await assertPaletteInvariants({ canvasElement, view: args, spies: args });
  },
};

export const S7: Story = {
  name: 'S7 検索 0 件 — 案内行 → 広げる提案（アクセント）→ 本体検索 の順',
  args: s7(ja),
  play: async ({ args, canvasElement }) => {
    const results = resultsGroup(canvasElement);
    await expect(kindsIn(results)).toEqual(['hint', 'search', 'panel', 'external']);
    await expect(results?.querySelectorAll<HTMLElement>('[role="option"]')[1]?.dataset.tone).toBe(
      'accent',
    );

    await assertPaletteInvariants({ canvasElement, view: args, spies: args });
  },
};

export const S8: Story = {
  name: 'S8 スコープ削除待ち — 右端の段が取り消し線／予告が出る／フッターの ⌫ ラベルが変わる',
  args: s8(ja),
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const segment = canvas.getByText(projects.web.name);
    await expect(getComputedStyle(segment).textDecorationLine).toContain('line-through');
    await expect(canvas.getByText(ja.palette.armedNotice(projects.web.name))).toBeVisible();
    await expect(hintLabel(canvasElement, 'back')).toContain(ja.keys.back(projects.web.name));

    await assertPaletteInvariants({ canvasElement, view: args, spies: args });
  },
};

export const S9: Story = {
  name: 'S9 コマンド階層 — 引数の行だけが並ぶ／esc ラベルが「1 つ前に戻る」／Esc で onEscape',
  args: s9(ja),
  play: async ({ args, canvasElement }) => {
    await expect(kindsIn(canvasElement)).toEqual(['space', 'space', 'space']);
    await expect(within(canvasElement).getByText(ja.palette.escBack)).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');
    await expect(args.onEscape).toHaveBeenCalledTimes(1);

    await assertPaletteInvariants({ canvasElement, view: args, spies: args });
  },
};

export const S10: Story = {
  name: 'S10 根 — 検索行が無い／接続済みスペースは space 行、未接続は connect 行／共通ページのセクションが出る',
  args: s10(ja),
  play: async ({ args, canvasElement }) => {
    await expect(kindsIn(canvasElement)).not.toContain('search');
    const spacesGroup = groups(canvasElement).find((group) => group.dataset.sectionId === 'spaces');
    await expect(kindsIn(spacesGroup)).toEqual(['space', 'space', 'connect']);
    await expect(sectionIds(canvasElement)).toEqual(['spaces', 'common']);
    await expect(
      within(canvasElement).getByPlaceholderText(ja.palette.rootPlaceholder),
    ).toBeVisible();

    await assertPaletteInvariants({ canvasElement, view: args, spies: args });
  },
};

export const S11: Story = {
  name: 'S11 認証切れ — 結果は無く再接続行だけ。パレット全体はエラー画面にならない',
  args: s11(ja),
  play: async ({ args, canvasElement }) => {
    await expect(kindsIn(resultsGroup(canvasElement))).toEqual(['status']);
    await expect(within(canvasElement).getByRole('combobox')).toBeVisible();
    await expect(hintLabel(canvasElement, 'enter')).toContain(ja.keys.connect);

    await assertPaletteInvariants({ canvasElement, view: args, spies: args });
  },
};

export const S12: Story = {
  name: 'S12 コピー直後 — フッター右端にトースト、ヒントは消えない',
  args: s12(ja),
  play: async ({ args, canvasElement }) => {
    await expect(within(canvasElement).getByRole('status')).toHaveTextContent(
      ja.rows.copied('PROJ-142'),
    );
    await expect(hintLabel(canvasElement, 'enter')).toContain(ja.keys.open);

    await assertPaletteInvariants({ canvasElement, view: args, spies: args });
  },
};

export const S13: Story = {
  name: 'S13 #もば でプロジェクト行を選択中 — フッターの ⇥ ラベルが「ここに絞り込む」／Tab で onTake、Enter で onAction',
  args: s13(ja),
  play: async ({ args, canvasElement }) => {
    await expect(hintLabel(canvasElement, 'take')).toContain(ja.keys.stack);

    const id = `project:${projects.mobile.key}`;
    args.onTake.mockClear();
    args.onAction.mockClear();
    await userEvent.keyboard('{Tab}');
    await expect(args.onTake).toHaveBeenCalledTimes(1);
    await expect(args.onTake).toHaveBeenCalledWith(id);
    await userEvent.keyboard('{Enter}');
    await expect(args.onAction).toHaveBeenCalledTimes(1);
    await expect(args.onAction).toHaveBeenCalledWith(id, { newTab: false });

    await assertPaletteInvariants({ canvasElement, view: args, spies: args });
  },
};

/** container の代わりに ref の focus() を呼ぶ。開き直しの合図は props ではなくこの呼び出し */
function Refocusable(props: PaletteProps) {
  const ref = useRef<FocusHandle>(null);
  return (
    <>
      <button type="button" onClick={() => ref.current?.focus()}>
        入力欄へ戻す
      </button>
      <StatefulPalette {...props} ref={ref} />
    </>
  );
}

export const Refocus: Story = {
  name: 'ref の focus() を呼ぶと、入力欄の外に出ていたフォーカスが入力欄へ戻る',
  render: (args) => <Refocusable {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('combobox', { name: ja.palette.inputLabel });
    const button = canvas.getByRole('button', { name: '入力欄へ戻す' });
    button.focus();
    await expect(button).toHaveFocus();
    // Overlay が画面を覆うのでポインタでは押せない。container と同じく直接呼ばせる
    button.click();
    await expect(input).toHaveFocus();
  },
};
