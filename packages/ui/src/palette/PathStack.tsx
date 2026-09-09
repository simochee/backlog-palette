import { Search } from 'lucide-react';
import { Avatar } from '../primitives/Avatar.tsx';
import styles from './PathStack.module.css';

export type PathSegment = {
  /** React の key に使う安定した識別子。省略時は label を使う */
  id?: string;
  label: string;
  /** ⌫ の 1 回目で立つ。取り消し線で「次の ⌫ で外れる」ことを予告する */
  armed?: boolean;
  /** スペースやプロジェクトのように出自バッジを添えるか */
  avatar?: boolean;
  /** 幅が足りないときにラベルを畳んでバッジだけにする */
  labelHidden?: boolean;
};

export type PathStackProps = {
  segments: readonly PathSegment[];
};

/**
 * 入力欄の中に積むスコープとコマンドのパス（§3 D2 / D3）。
 *
 * 個別に消せるチップにはしない。右端からしか外せないことを見た目で示すため、
 * セグメントは常にスラッシュ区切りのパスとして描く。
 */
export function PathStack({ segments }: PathStackProps) {
  return (
    <span className={styles.stack}>
      <Search size={16} strokeWidth={1.75} className={styles.searchIcon} aria-hidden />
      {segments.map((segment, index) => (
        <span key={segment.id ?? segment.label} className={styles.group}>
          <span
            className={styles.segment}
            data-armed={segment.armed || undefined}
            data-current={index === segments.length - 1 || undefined}
          >
            {segment.avatar ? <Avatar label={segment.label} size={16} /> : null}
            {segment.labelHidden ? null : segment.label}
          </span>
          <span className={styles.slash} data-armed={segment.armed || undefined} aria-hidden>
            /
          </span>
        </span>
      ))}
    </span>
  );
}
