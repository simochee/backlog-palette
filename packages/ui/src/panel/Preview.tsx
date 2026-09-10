import { Avatar } from '../primitives/Avatar.tsx';
import { Marker } from '../primitives/Marker.tsx';
import { RowIcon } from '../primitives/RowIcon.tsx';
import type { RowKind, RowMarker } from '../primitives/types.ts';
import styles from './Preview.module.css';

/**
 * 本文の一片。ハイライトするかは呼び出し側が決める。
 *
 * キーワードを渡して照合させない。全角半角・かな・カスタム辞書の正規化は
 * 検索側が持つ規則で、ここで別の規則を実装すると本文と結果の一致がずれる。
 */
export type PreviewSegment = {
  text: string;
  highlight?: boolean;
};

export type PreviewMeta = { label: string; value: string };

export type PreviewProps = {
  kind: RowKind;
  code?: string;
  title: string;
  /** プロジェクト名など、どれを見ているかを示す補足 */
  sub?: string;
  marker?: RowMarker;
  tag?: RowMarker;
  avatar?: { label: string };
  excerpt?: readonly PreviewSegment[];
  /** 本文を持たない種別のときに出す説明 */
  bodylessNote?: string;
  meta?: readonly PreviewMeta[];
  /** pane = 右ペイン / inline = 狭い幅での選択行のインライン展開 */
  variant?: 'pane' | 'inline';
};

type KeyedSegment = PreviewSegment & { key: string };

/**
 * key は配列の添字ではなく本文中の開始位置から作る。抜粋が伸び縮みしても
 * 同じ位置の断片が同じ key を保ち、ハイライトの再マウントが起きない。
 */
function withKeys(segments: readonly PreviewSegment[]): readonly KeyedSegment[] {
  let offset = 0;
  return segments.map((segment) => {
    const key = `${offset}`;
    offset += segment.text.length;
    return { ...segment, key };
  });
}

export function Preview({
  kind,
  code,
  title,
  sub,
  marker,
  tag,
  avatar,
  excerpt,
  bodylessNote,
  meta,
  variant = 'pane',
}: PreviewProps) {
  const segments = excerpt === undefined ? [] : withKeys(excerpt);

  /*
   * inline は展開元の行が種別・識別子・タイトル・プロジェクトを既に出しているので、
   * 共通ヘッダーを描かない。同じ文字列が続けて 2 回読み上げられるのを避ける。
   */
  const showHeader = variant === 'pane';

  return (
    <div className={styles.preview} data-variant={variant}>
      {showHeader ? (
        <>
          <div className={styles.head}>
            <span className={styles.icon}>
              <RowIcon kind={kind} size={15} />
            </span>
            {tag ? <Marker {...tag} /> : null}
            {code ? <span className={styles.code}>{code}</span> : null}
            <span className={styles.headSpacer} />
            {avatar ? <Avatar label={avatar.label} /> : null}
          </div>

          <p className={styles.title}>{title}</p>

          {marker || sub ? (
            <div className={styles.subline}>
              {marker ? <Marker {...marker} dot /> : null}
              {sub ? <span className={styles.sub}>{sub}</span> : null}
            </div>
          ) : null}
        </>
      ) : null}

      {segments.length > 0 ? (
        <p className={styles.body}>
          {segments.map((segment) =>
            segment.highlight ? (
              <mark key={segment.key} className={styles.mark}>
                {segment.text}
              </mark>
            ) : (
              <span key={segment.key}>{segment.text}</span>
            ),
          )}
        </p>
      ) : (
        <p className={styles.bodyless}>{bodylessNote ?? 'この種別は本文を持ちません'}</p>
      )}

      {meta && meta.length > 0 ? (
        <dl className={styles.meta}>
          {meta.map((item) => (
            <div key={item.label} className={styles.metaItem}>
              <dt className={styles.metaLabel}>{item.label}</dt>
              <dd className={styles.metaValue}>{item.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}
