import { TriangleAlert } from 'lucide-react';
import { Avatar } from '../primitives/Avatar.tsx';
import { Button } from '../primitives/Button.tsx';
import styles from './StatusStrip.module.css';

export type SpaceState = 'loading' | 'ready' | 'error';

export type SpaceStatus = {
  id: string;
  label: string;
  state: SpaceState;
  /** ready のときの件数 */
  count?: number;
  /** error のときの説明。「認証が切れました」など */
  message?: string;
  /** error のときの操作。「再接続」など */
  action?: { label: string; onPress: () => void };
};

export type StatusStripProps = {
  spaces: readonly SpaceStatus[];
  /** 全て揃ったときに 1 行で出す要約。省略時は件数から組む */
  summary?: string;
};

function totalOf(spaces: readonly SpaceStatus[]): number {
  return spaces.reduce((sum, space) => sum + (space.count ?? 0), 0);
}

function SpaceChip({ space }: { space: SpaceStatus }) {
  return (
    <span className={styles.chip} data-state={space.state}>
      {space.state === 'error' ? (
        <TriangleAlert size={14} strokeWidth={2} className={styles.warning} aria-hidden />
      ) : (
        <Avatar label={space.label} size={16} />
      )}

      <span className={styles.chipLabel}>{space.label}</span>

      {space.state === 'loading' ? (
        <>
          <span className={styles.spinner} aria-hidden />
          <span className={styles.chipMeta}>読み込み中</span>
        </>
      ) : null}

      {space.state === 'ready' ? (
        <span className={styles.chipMeta}>{space.count ?? 0} 件</span>
      ) : null}

      {space.state === 'error' && space.message ? (
        <span className={styles.chipMessage}>{space.message}</span>
      ) : null}

      {space.action ? <Button onPress={space.action.onPress}>{space.action.label}</Button> : null}
    </span>
  );
}

/**
 * スペース単位の進捗・件数・エラーを結果リストの外に固定で置く（§3 D6）。
 *
 * モック B3 はこれをグループ見出しとして結果リストに差し込んでいたが、
 * 後から返ったスペースの行が選択行より上に挿入されて選択位置が動く。
 * 情報は落とさずに、動いてはいけない場所から出す。
 */
export function StatusStrip({ spaces, summary }: StatusStripProps) {
  if (spaces.length === 0) return null;

  const settled = spaces.every((space) => space.state === 'ready');

  if (settled) {
    return (
      <div className={styles.strip} data-collapsed="" aria-live="polite">
        <span className={styles.summary}>
          {summary ?? `${spaces.length} スペース · ${totalOf(spaces)} 件`}
        </span>
      </div>
    );
  }

  return (
    <div className={styles.strip} aria-live="polite">
      {spaces.map((space) => (
        <SpaceChip key={space.id} space={space} />
      ))}
    </div>
  );
}
