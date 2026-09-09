/**
 * 入力文字列から「絞り込み条件」を切り出し、残りを検索語句として返す。
 *
 * モーダル自身は属性で候補を絞らない（docs/implementation-plan.md §3 D4）。
 * ここで組み立てた条件をサイドパネルへ引き渡し、条件チップとして提示する。
 */

export type SpaceVocabulary = {
  /** そのスペースに実在するステータス名。カスタムステータスを含む */
  statusNames: readonly string[];
  /** 課題種別名。中間案・広い案でのみ参照する */
  issueTypeNames: readonly string[];
  /** プロジェクトメンバーの表示名。広い案でのみ参照する */
  memberNames: readonly string[];
};

export type DetectedCondition =
  | { field: 'status'; value: string; source: string }
  | { field: 'assignee'; value: 'me' | string; source: string }
  | { field: 'issueType'; value: string; source: string };

export type DetectionResult = {
  /** サイドパネルに引き渡す条件。空配列なら語句のまま検索する */
  conditions: DetectedCondition[];
  /** 条件として消費した語を除いた、検索語句としての残り */
  keyword: string;
};

/**
 * TODO: 検出方針を実装する。
 *
 * 判断してほしいのは「どこまで賢くすると気持ち悪くならないか」。
 * 実装プラン §20 に 3 案（狭い / 中間 / 広い）とトレードオフをまとめてある。
 *
 * 考慮すべき点:
 *  - 誤検出のコストは非対称。条件を取りこぼしても損は小さいが、
 *    普通の語を条件に化けさせると P6（筋肉記憶）が壊れる
 *  - 「完了」「要望」はステータス名・種別名でありながら日常語としても頻出する
 *    （「完了報告書」「要望一覧」）。単独入力に限るなどの例外が要るか
 *  - 条件チップが出た理由が、ユーザーに常に自明であること
 *  - 条件を全部外すと keyword は入力そのものに戻る（⌫ の挙動）
 *
 * @param input 正規化済みの入力（normalize() を通した後）
 * @param vocab 現在スコープのスペースの語彙
 */
export function detectConditions(input: string, vocab: SpaceVocabulary): DetectionResult {
  void vocab;
  return { conditions: [], keyword: input };
}
