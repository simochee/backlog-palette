import type { ColorScheme } from './colorScheme';

/**
 * Backlog がテーマとして宣言する CSS 変数（backlog-facts.md §7）。
 * パレットはページで解決された値を同じ名前のまま自分のルートに置き、トークンから直接参照する
 */
export const BACKLOG_THEME_VARIABLES = [
  '--defaultColorMain',
  '--defaultColorAccent',
  '--defaultColorAccent-rgb',
  '--defaultColorBase',
  '--defaultColorBase-rgb',
  '--defaultColorBase-2',
  '--defaultColorLink',
  '--defaultColorSub-1',
  '--backgroundColorSchemeBase',
] as const;

export type BacklogThemeVariable = (typeof BACKLOG_THEME_VARIABLES)[number];

export type BacklogTheme = {
  /** 値がどちらの配色のものか。Backlog 本体のダークモードでは同じ変数が別の値になる */
  scheme: ColorScheme;
  variables: Record<BacklogThemeVariable, string>;
};

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/iu;
const RGB_CHANNELS = /^\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}$/u;

/*
 * ページから届いた文字列をそのまま style に置かず、Backlog が実際に宣言している 2 つの形
 * （#rrggbb と `-rgb` 変数の「r, g, b」）に絞る（D-58）
 */
function toThemeValue(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return HEX_COLOR.test(trimmed) || RGB_CHANNELS.test(trimmed) ? trimmed : undefined;
}

/*
 * 1 つでも欠けたら全体を捨てる。Backlog は :root に既定値を宣言しているので、欠けているのは
 * ReactApp.css を読まないページか想定外の DOM。部分的に置くと、トークンが参照する
 * 変数が未定義になり、パレットの一部だけが unset に落ちる
 */
function collectVariables(
  pick: (name: BacklogThemeVariable) => unknown,
): BacklogTheme['variables'] | undefined {
  const entries = BACKLOG_THEME_VARIABLES.map((name) => [name, toThemeValue(pick(name))] as const);
  if (entries.some(([, value]) => value === undefined)) return undefined;
  return Object.fromEntries(entries) as BacklogTheme['variables'];
}

/** content script 側。`readVariable` には body の computed style を読む関数を渡す */
export function readBacklogTheme(
  readVariable: (name: string) => string,
  scheme: ColorScheme,
): BacklogTheme | undefined {
  const variables = collectVariables(readVariable);
  return variables === undefined ? undefined : { scheme, variables };
}

/**
 * iframe 側。postMessage で届いた値を検証し直す。ページ自身のスクリプトも content script と
 * 同じ window から送れるので、届いた時点では content script が読んだ値だとは限らない
 */
export function parseBacklogTheme(value: unknown): BacklogTheme | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const scheme: unknown = Reflect.get(value, 'scheme');
  if (scheme !== 'light' && scheme !== 'dark') return undefined;
  const received: unknown = Reflect.get(value, 'variables');
  if (typeof received !== 'object' || received === null) return undefined;
  const variables = collectVariables((name) => Reflect.get(received, name));
  return variables === undefined ? undefined : { scheme, variables };
}

/**
 * 変数をルートに置き、`data-backlog-theme` に値の配色を書く。
 * どの `--bp-*` トークンが参照するか、どの配色で効かせるかは components/tokens/backlog-theme.css が決める
 */
export function applyBacklogTheme(root: HTMLElement, theme: BacklogTheme | undefined) {
  for (const name of BACKLOG_THEME_VARIABLES) {
    const value = theme?.variables[name];
    if (value === undefined) root.style.removeProperty(name);
    else root.style.setProperty(name, value);
  }
  if (theme === undefined) delete root.dataset.backlogTheme;
  else root.dataset.backlogTheme = theme.scheme;
}
