import type { MarkerTone } from './types.ts';

/** Backlog の組み込みステータス。この 4 つは id が固定されている */
const BUILTIN_STATUS_TONE: Record<number, MarkerTone> = {
  1: 'neutral', // 未対応
  2: 'info', // 処理中
  3: 'success', // 処理済み
  4: 'done', // 完了
};

const ISSUE_TYPE_TONE: Record<string, MarkerTone> = {
  タスク: 'success',
  バグ: 'danger',
  要望: 'info',
  運用: 'warning',
  その他: 'neutral',
};

type Hsl = { hue: number; saturation: number };

function hexToHsl(hex: string): Hsl | undefined {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (match?.[1] === undefined) return undefined;

  const value = Number.parseInt(match[1], 16);
  const r = ((value >> 16) & 0xff) / 255;
  const g = ((value >> 8) & 0xff) / 255;
  const b = (value & 0xff) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  if (delta === 0) return { hue: 0, saturation: 0 };

  const hueBase =
    max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;

  return {
    hue: (((hueBase * 60) % 360) + 360) % 360,
    saturation: delta / (1 - Math.abs(max + min - 1) || 1),
  };
}

/**
 * カスタムステータスは色しか手掛かりが無いため、色相から最も近い tone へ写す。
 *
 * ステータス名で分岐しない。プロジェクトごとに任意の名前が付けられるので、
 * 名前を条件にすると特定の運用（「レビュー中」など）だけが正しく色付き、
 * 他は既定色に落ちるという不均等な結果になる。
 */
export function toneFromColor(hex: string): MarkerTone {
  const hsl = hexToHsl(hex);
  if (hsl === undefined || hsl.saturation < 0.15) return 'neutral';

  const { hue } = hsl;
  if (hue < 20 || hue >= 340) return 'danger';
  if (hue < 50) return 'warning';
  if (hue < 160) return 'success';
  if (hue < 260) return 'info';
  return 'done';
}

export function statusTone(status: { id: number; color?: string }): MarkerTone {
  const builtin = BUILTIN_STATUS_TONE[status.id];
  if (builtin !== undefined) return builtin;
  return status.color === undefined ? 'neutral' : toneFromColor(status.color);
}

/**
 * 課題種別は Backlog 側の色設定を見ない。
 *
 * 種別の色はプロジェクトごとに自由に変えられるため、色に従うと
 * 「バグは赤」という利用者側の学習がプロジェクトをまたいだ瞬間に崩れる。
 */
export function issueTypeTone(name: string): MarkerTone {
  return ISSUE_TYPE_TONE[name] ?? 'neutral';
}
