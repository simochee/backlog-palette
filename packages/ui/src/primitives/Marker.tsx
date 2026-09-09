import styles from './primitives.module.css';
import type { RowMarker } from './types.ts';

export type MarkerProps = RowMarker & {
  /** 点を出すか（状態バッジは点あり、分類バッジは点なし） */
  dot?: boolean;
};

export function Marker({ label, tone, dot = false }: MarkerProps) {
  return (
    <span className={styles.marker} data-tone={tone} data-dot={dot || undefined}>
      {dot ? <span className={styles.markerDot} /> : null}
      {label}
    </span>
  );
}
