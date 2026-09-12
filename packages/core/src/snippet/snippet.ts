import { fold, sourceRange } from '../match/fold.ts';
import { normalize } from '../query/normalize.ts';

/**
 * プレビューに出す本文の抜粋（実装プラン §5.3 の B2-a・§6.4）。
 *
 * API はヒット位置を返さないので、切り出しとハイライトはこちらで作る。
 * 照合は `normalize` を通した正規形で行い、位置は元の本文の添字で返す。
 */

export type SnippetSegment = {
  text: string;
  highlight?: boolean;
};

export type SnippetOptions = {
  /** 抜粋の長さ（元の本文の文字数） */
  length?: number;
  /** 最初のヒットの手前に残す文字数 */
  lead?: number;
};

const DEFAULT_LENGTH = 240;
const DEFAULT_LEAD = 16;
const ELLIPSIS = '…';

type Range = readonly [number, number];

export function snippet(
  body: string,
  query: string,
  options: SnippetOptions = {},
): readonly SnippetSegment[] {
  if (body === '') return [];

  const length = options.length ?? DEFAULT_LENGTH;
  const lead = options.lead ?? DEFAULT_LEAD;
  const hits = hitsIn(body, query);
  const [start, end] = windowFor(body, hits[0], length, lead);

  const segments: SnippetSegment[] = [];
  if (body.slice(0, start).trim() !== '') segments.push({ text: ELLIPSIS });

  let cursor = start;
  for (const [from, to] of hits) {
    if (to <= start) continue;
    if (from >= end) break;

    const hitStart = Math.max(from, start);
    const hitEnd = Math.min(to, end);
    if (cursor < hitStart) segments.push({ text: body.slice(cursor, hitStart) });
    segments.push({ text: body.slice(hitStart, hitEnd), highlight: true });
    cursor = hitEnd;
  }
  if (cursor < end) segments.push({ text: body.slice(cursor, end) });

  if (body.slice(end).trim() !== '') segments.push({ text: ELLIPSIS });

  return segments;
}

/** 語ごとの出現位置。重なりは 1 つにまとめ、元の本文の [開始, 終了) で返す */
function hitsIn(body: string, query: string): readonly Range[] {
  const terms = normalize(query)
    .split(/\s+/)
    .filter((term) => term !== '');
  if (terms.length === 0) return [];

  const folded = fold(body);
  const found: Range[] = [];

  for (const term of terms) {
    let at = folded.value.indexOf(term);
    while (at !== -1) {
      found.push(sourceRange(folded, at, at + term.length - 1));
      at = folded.value.indexOf(term, at + term.length);
    }
  }

  return merged(found);
}

function merged(ranges: readonly Range[]): readonly Range[] {
  const sorted = [...ranges].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const out: Range[] = [];

  for (const range of sorted) {
    const last = out[out.length - 1];
    if (last !== undefined && range[0] <= last[1]) {
      out[out.length - 1] = [last[0], Math.max(last[1], range[1])];
      continue;
    }
    out.push(range);
  }

  return out;
}

/**
 * ヒットが先頭に来るように窓を決める。冒頭から固定長で切ると、探している語が
 * 抜粋の外に落ちて「一致したはずのものが見えない」プレビューになる。
 */
function windowFor(body: string, first: Range | undefined, length: number, lead: number): Range {
  const from = first === undefined ? 0 : Math.max(0, first[0] - lead);
  const to = Math.max(from + length, first?.[1] ?? 0);

  return trimmed(body, wholeCharacters(body, from, Math.min(to, body.length)));
}

/**
 * 窓の端がサロゲートペアの途中に落ちると、切り出した文字列に単独の
 * サロゲートが残って文字化けする。絵文字を含む本文で実際に起きる。
 */
function wholeCharacters(body: string, from: number, to: number): Range {
  const start = from > 0 && isLowSurrogate(body, from) ? from - 1 : from;
  const end = to < body.length && isHighSurrogate(body, to - 1) ? to - 1 : to;
  return [start, Math.max(start, end)];
}

function isHighSurrogate(text: string, index: number): boolean {
  const code = text.charCodeAt(index);
  return code >= 0xd800 && code <= 0xdbff;
}

function isLowSurrogate(text: string, index: number): boolean {
  const code = text.charCodeAt(index);
  return code >= 0xdc00 && code <= 0xdfff;
}

const SPACE = /\s/;

/** 本文は改行をそのまま残すので、窓の端の空白を落としておかないと空行から始まる */
function trimmed(body: string, [from, to]: Range): Range {
  let start = from;
  let end = to;
  while (start < end && SPACE.test(body.charAt(start))) start += 1;
  while (end > start && SPACE.test(body.charAt(end - 1))) end -= 1;
  return [start, end];
}
