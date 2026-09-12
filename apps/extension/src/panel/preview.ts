import { snippet } from '@backlog-palette/core';
import type { PreviewProps } from '@backlog-palette/ui';
import type { SearchResultRow } from '../messaging/ext.ts';

/**
 * 選択中の行をプレビューへ写す（実装プラン §5.3 の B2-a）。
 *
 * 開かずに中身が読めることが目的なので、本文はヒット位置まで送ってから切り出す。
 * API はヒット位置を返さないため、照合はこちら側で行う（§6.4）。
 */

const BODYLESS_NOTE: Record<SearchResultRow['kind'], string> = {
  issue: '詳細が書かれていない課題です。開くとコメントまで読めます',
  wiki: '本文を取得できていません。開くと最新の内容が読めます',
  document: '本文を取得できていません。開くと最新の内容が読めます',
};

function day(at: number): string {
  const date = new Date(at);
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}

export function previewFor(row: SearchResultRow, query: string): PreviewProps {
  const excerpt = row.body === undefined ? [] : snippet(row.body, query);

  return {
    kind: row.kind,
    ...(row.code === undefined ? {} : { code: row.code }),
    title: row.title,
    ...(row.sub === undefined ? {} : { sub: row.sub }),
    ...(row.marker === undefined ? {} : { marker: row.marker }),
    ...(row.tag === undefined ? {} : { tag: row.tag }),
    ...(row.avatar === undefined ? {} : { avatar: row.avatar }),
    ...(excerpt.length === 0 ? {} : { excerpt }),
    bodylessNote: BODYLESS_NOTE[row.kind],
    meta: [
      { label: 'スペース', value: row.spaceKey },
      { label: '更新', value: day(row.updatedAt) },
    ],
  };
}
