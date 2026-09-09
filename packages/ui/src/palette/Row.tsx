import { Avatar } from '../primitives/Avatar.tsx';
import { Kbd } from '../primitives/Kbd.tsx';
import { Marker } from '../primitives/Marker.tsx';
import { RowIcon } from '../primitives/RowIcon.tsx';
import type { RowHint, RowKind, RowMarker, RowTone } from '../primitives/types.ts';
import styles from './Row.module.css';

const HINT_KEYS: Record<Exclude<RowHint, 'none' | 'more'>, readonly string[]> = {
  enter: ['↵'],
  modEnter: ['⌘', '↵'],
};

export type RowProps = {
  kind: RowKind;
  code?: string;
  title: string;
  sub?: string;
  marker?: RowMarker;
  tag?: RowMarker;
  avatar?: { label: string };
  hint?: RowHint;
  selected?: boolean;
  tone?: RowTone;
};

/**
 * 全サーフェス共通の唯一の行コンポーネント（§5.2）。
 *
 * 選択は面の反転・左端 2px のアクセント罫・タイトルの太字化の 3 点で示す。
 * この行は選択状態を自分で持たない。ListBox 側の状態を data 属性で受ける。
 */
export function Row({
  kind,
  code,
  title,
  sub,
  marker,
  tag,
  avatar,
  hint = 'none',
  selected = false,
  tone = 'default',
}: RowProps) {
  return (
    <div className={styles.row} data-tone={tone} data-selected={selected || undefined}>
      <span className={styles.icon}>
        <RowIcon kind={kind} />
      </span>

      <span className={styles.body}>
        <span className={styles.line}>
          {tag ? <Marker {...tag} /> : null}
          {code ? <span className={styles.code}>{code}</span> : null}
          <span className={styles.title}>{title}</span>
        </span>

        {marker || sub ? (
          <span className={styles.line}>
            {marker ? <Marker {...marker} dot /> : null}
            {sub ? <span className={styles.sub}>{sub}</span> : null}
          </span>
        ) : null}
      </span>

      {avatar ? <Avatar label={avatar.label} /> : null}

      {hint === 'more' ? (
        <span className={styles.more}>
          次へ<span aria-hidden>›</span>
        </span>
      ) : null}
      {hint === 'enter' || hint === 'modEnter' ? (
        <Kbd keys={HINT_KEYS[hint]} dim={!selected} />
      ) : null}
    </div>
  );
}
