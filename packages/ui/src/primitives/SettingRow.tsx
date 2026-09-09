import type { ReactNode } from 'react';
import styles from './settings.module.css';

export type SettingRowProps = {
  label: ReactNode;
  description?: ReactNode;
  /** 右端に置くコントロール。読むだけの行では省く */
  control?: ReactNode;
};

export function SettingRow({ label, description, control }: SettingRowProps) {
  return (
    <div className={styles.row}>
      <span className={styles.rowBody}>
        <span className={styles.rowLabel}>{label}</span>
        {description ? <span className={styles.rowDescription}>{description}</span> : null}
      </span>
      {control ? <span className={styles.rowControl}>{control}</span> : null}
    </div>
  );
}
