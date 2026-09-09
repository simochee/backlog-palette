import { DEFAULT_SETTINGS, type Settings, settingsItem } from '../storage/schema.ts';

export type ResolvedColorScheme = 'light' | 'dark';

export async function loadSettings(): Promise<Settings> {
  return { ...DEFAULT_SETTINGS, ...(await settingsItem.getValue()) };
}

/**
 * 設定画面には保存ボタンが無く、1 項目ずつ書き戻す。読み直してから
 * 差分を重ねるので、画面に出していない項目（keywordTarget など）が消えない。
 */
export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await loadSettings()), ...patch };
  await settingsItem.setValue(next);
  return next;
}

export function resolveColorScheme(
  colorScheme: Settings['colorScheme'],
  prefersDark: boolean,
): ResolvedColorScheme {
  if (colorScheme === 'system') return prefersDark ? 'dark' : 'light';
  return colorScheme;
}
