import { expect, fireEvent, isMockFunction, userEvent, within } from 'storybook/test';

import { flattenRows } from '@/components/organisms/CandidateList';
import type { KeyHint, RowView, SectionView } from '@/components/types';

type Procedure = (...args: never[]) => unknown;

export type InvariantSpies = {
  onAction: (id: string, opts: { newTab: boolean }) => void;
  onSelectionChange: (id: string) => void;
  onTake: (id: string) => void;
  onBackspaceAtStart?: () => void;
  onCopySearchUrl?: () => void;
  onOpenPanel?: () => void;
  onSearch?: (query: string) => void;
};

export type InvariantView = {
  sections: readonly SectionView[];
  footer: readonly KeyHint[];
  selectedId?: string;
};

type Target = {
  canvasElement: HTMLElement;
  view: InvariantView;
  spies: InvariantSpies;
};

async function expectCalledOnceWith(mock: ReturnType<typeof spy>, ...args: unknown[]) {
  await expect(mock).toHaveBeenCalledTimes(1);
  await expect(mock).toHaveBeenCalledWith(...args);
}

function spy<T extends Procedure>(callback: T | undefined, name: string) {
  if (callback === undefined || !isMockFunction(callback))
    throw new Error(`${name} は fn() で渡してください`);
  return callback;
}

async function pressAll(key: string, times: number) {
  for (let index = 0; index < times; index += 1) await userEvent.keyboard(`{${key}}`);
}

type FooterCheck = (
  input: HTMLInputElement,
  rows: readonly RowView[],
  target: Target,
) => Promise<void>;

const selectedRow = (rows: readonly RowView[], view: InvariantView) =>
  rows.find((row) => row.id === view.selectedId);

const footerChecks: Record<KeyHint['id'], FooterCheck> = {
  async enter(_input, rows, { view, spies }) {
    const selected = selectedRow(rows, view);
    const onAction = spy(spies.onAction, 'onAction');
    onAction.mockClear();
    await userEvent.keyboard('{Enter}');
    if (selected === undefined) {
      await expect(spy(spies.onSearch, 'onSearch')).toHaveBeenCalledTimes(1);
    } else {
      await expectCalledOnceWith(onAction, selected.id, { newTab: false });
    }
  },
  async modEnter(_input, rows, { view, spies }) {
    const onAction = spy(spies.onAction, 'onAction');
    onAction.mockClear();
    await userEvent.keyboard('{Meta>}{Enter}{/Meta}');
    await expectCalledOnceWith(onAction, selectedRow(rows, view)?.id, { newTab: true });
  },
  async move(_input, rows, { view, spies }) {
    const onSelectionChange = spy(spies.onSelectionChange, 'onSelectionChange');
    onSelectionChange.mockClear();
    const index = rows.findIndex((row) => row.id === view.selectedId);
    const next = rows[index + 1];
    if (next === undefined) {
      await userEvent.keyboard('{ArrowUp}');
      await expect(onSelectionChange).toHaveBeenLastCalledWith(rows[index - 1]?.id);
      await userEvent.keyboard('{ArrowDown}');
    } else {
      await userEvent.keyboard('{ArrowDown}');
      await expect(onSelectionChange).toHaveBeenLastCalledWith(next.id);
      await userEvent.keyboard('{ArrowUp}');
    }
  },
  async back(input, _rows, { spies }) {
    const onBackspaceAtStart = spy(spies.onBackspaceAtStart, 'onBackspaceAtStart');
    onBackspaceAtStart.mockClear();
    input.setSelectionRange(0, 0);
    await userEvent.keyboard('{Backspace}');
    await expect(onBackspaceAtStart).toHaveBeenCalledTimes(1);
    input.setSelectionRange(input.value.length, input.value.length);
  },
  async take(_input, rows, { view, spies }) {
    const onTake = spy(spies.onTake, 'onTake');
    onTake.mockClear();
    await userEvent.keyboard('{Tab}');
    await expectCalledOnceWith(onTake, selectedRow(rows, view)?.id);
  },
  async copyUrl(_input, _rows, { spies }) {
    const onCopySearchUrl = spy(spies.onCopySearchUrl, 'onCopySearchUrl');
    onCopySearchUrl.mockClear();
    await userEvent.keyboard('{Meta>}{Shift>}c{/Shift}{/Meta}');
    await expect(onCopySearchUrl).toHaveBeenCalledTimes(1);
  },
  async toPanel(_input, _rows, { spies }) {
    const onOpenPanel = spy(spies.onOpenPanel, 'onOpenPanel');
    onOpenPanel.mockClear();
    await userEvent.keyboard('{Meta>}{ArrowRight}{/Meta}');
    await expect(onOpenPanel).toHaveBeenCalledTimes(1);
  },
};

/** I2: フッターに出ているキーを押すと対応するハンドラが呼ばれる */
async function assertFooterKeys(input: HTMLInputElement, rows: readonly RowView[], target: Target) {
  for (const hint of target.view.footer) await footerChecks[hint.id](input, rows, target);
}

/** I1: ヒントを持つ行で Enter を押すと onAction が呼ばれ、持たない行では何も起きない */
async function assertRowEnter(rows: readonly RowView[], target: Target) {
  const onAction = spy(target.spies.onAction, 'onAction');
  await pressAll('ArrowUp', rows.length);

  for (const [index, row] of rows.entries()) {
    onAction.mockClear();
    await userEvent.keyboard('{Enter}');
    if (row.hints.length > 0) {
      await expectCalledOnceWith(onAction, row.id, { newTab: false });
    } else {
      await expect(onAction).not.toHaveBeenCalled();
    }
    if (index < rows.length - 1) await userEvent.keyboard('{ArrowDown}');
  }
}

/** I3: Tab を押してもフォーカスは入力欄から出ない */
async function assertTabKeepsFocus(input: HTMLInputElement) {
  await userEvent.keyboard('{Tab}');
  await expect(document.activeElement).toBe(input);
  await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
  await expect(document.activeElement).toBe(input);
}

/** I5: 変換中の Enter では onAction が呼ばれない */
async function assertComposingEnterIsIgnored(input: HTMLInputElement, target: Target) {
  const onAction = spy(target.spies.onAction, 'onAction');
  onAction.mockClear();
  await fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
  await fireEvent.keyDown(input, { key: 'Process', isComposing: true });
  await expect(onAction).not.toHaveBeenCalled();
}

/** Palette と SidePanel の全状態 story が呼ぶ共通の検査（ui-components.md §5.1） */
export async function assertPaletteInvariants(target: Target) {
  const canvas = within(target.canvasElement);
  const input = canvas.getByRole<HTMLInputElement>('combobox');
  const rows = flattenRows(target.view.sections);

  await userEvent.click(input);
  input.setSelectionRange(input.value.length, input.value.length);

  // 状態固有の検査がキーを送った後でも同じ前提から始めるため、選択を view の初期位置へ戻す
  const initialIndex = Math.max(
    0,
    rows.findIndex((row) => row.id === target.view.selectedId),
  );
  await pressAll('ArrowUp', rows.length);
  await pressAll('ArrowDown', initialIndex);

  await assertFooterKeys(input, rows, target);
  await assertRowEnter(rows, target);
  await assertTabKeepsFocus(input);
  await assertComposingEnterIsIgnored(input, target);
}
