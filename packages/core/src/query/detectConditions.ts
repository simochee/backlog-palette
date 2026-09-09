import { normalize } from './normalize.ts';

/**
 * 入力文字列から「絞り込み条件」を切り出し、残りを検索語句として返す。
 *
 * モーダル自身は属性で候補を絞らない（実装プラン §3 D4）。ここで組み立てた
 * 条件をサイドパネルへ引き渡し、外せるチップとして提示する。
 */

export type SpaceVocabulary = {
  /** そのスペースに実在するステータス名。カスタムステータスを含む */
  statusNames: readonly string[];
};

export type DetectedCondition = {
  field: 'status';
  /** 語彙に載っている表記（正規化前）。UI にはこれを出す */
  value: string;
  /** 入力から取り除いた語 */
  source: string;
};

export type DetectionResult = {
  /** サイドパネルに引き渡す条件。空配列なら語句のまま検索する */
  conditions: DetectedCondition[];
  /** 条件として消費した語を除いた、検索語句としての残り */
  keyword: string;
};

/*
 * 語の切れ目は空白だけにする。形態素解析で「完了報告書」から「完了」を
 * 取り出すと、条件が出た理由がユーザーに説明できなくなる。
 * 誤検出のコストは非対称で、取りこぼしの損は小さいが、普通の語が条件に
 * 化けると同じ入力で同じ結果という前提（P6）が崩れる。
 */
const SEPARATOR = /[\s　]+/;

/**
 * ステータス名と完全一致する語だけを条件として切り出す。
 *
 * 部分一致を採らないので「完了報告書」は条件にならない。日常語と重なる
 * ステータス名（完了・要望など）を特別扱いする必要も無くなる。
 *
 * 条件は 1 つだけ。Backlog の検索は OR ができず、ステータスは単一選択に
 * なるため（§3 D5）、2 つ目以降は語句のまま残す。
 */
export function detectConditions(input: string, vocab: SpaceVocabulary): DetectionResult {
  const byNormalized = new Map(vocab.statusNames.map((name) => [normalize(name), name]));

  const conditions: DetectedCondition[] = [];
  const rest: string[] = [];

  for (const token of input.split(SEPARATOR)) {
    if (token === '') continue;

    const matched = byNormalized.get(normalize(token));
    if (matched !== undefined && conditions.length === 0) {
      conditions.push({ field: 'status', value: matched, source: token });
      continue;
    }
    rest.push(token);
  }

  return { conditions, keyword: rest.join(' ') };
}
