import type { CSSProperties } from 'react';
import styles from './primitives.module.css';

export type AvatarProps = {
  label: string;
  size?: number;
};

function hueOf(label: string): number {
  let hue = 7;
  for (const char of label) {
    hue = (hue * 31 + (char.codePointAt(0) ?? 0)) % 360;
  }
  return hue;
}

/**
 * 出自バッジ（スペース相当）。画像を持たないので頭文字で示す。
 * 色は label から決めるので、同じスペースは常に同じ色になる。
 */
export function Avatar({ label, size = 18 }: AvatarProps) {
  const style = {
    width: size,
    height: size,
    '--bp-avatar-hue': hueOf(label),
  } as CSSProperties;

  return (
    <span className={styles.avatar} style={style} role="img" title={label} aria-label={label}>
      {[...label][0]?.toUpperCase() ?? '?'}
    </span>
  );
}
