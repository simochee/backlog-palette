/**
 * ストレージに保存する値のうち、packages/core の型と一致させたいもの。
 *
 * core を import せずに構造だけ合わせる。apps/extension が両者を知る
 * 唯一の場所なので、一致は橋渡し用の型アサーションで担保する（§6.2）。
 */
export type KeywordTarget = 'subject' | 'subjectAndBody' | 'subjectBodyAndComment';
