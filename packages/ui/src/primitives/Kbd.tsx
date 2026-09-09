import styles from './primitives.module.css';

export type KbdProps = {
  keys: readonly string[];
  dim?: boolean;
};

/** キーヒント。押した後も消さない（P5） */
export function Kbd({ keys, dim = false }: KbdProps) {
  return (
    <span className={dim ? `${styles.kbd} ${styles.kbdDim}` : styles.kbd} aria-hidden>
      {keys.map((key) => (
        <kbd key={key} className={styles.kbdKey}>
          {key}
        </kbd>
      ))}
    </span>
  );
}
