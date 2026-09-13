import { SEARCH_STATE_VERSION, type SearchState, searchStateSchema } from './schema';

/**
 * フラグメントはサーバーへ送られない。共有リンクを踏んだだけで誰の検索条件かが Backlog 側の
 * ログに残らないこと、拡張なしでも素の Backlog ページとして開けること（§7.6）はこの非送信性の上に
 * 成り立つ。クエリパラメータへ移すと両方が壊れる
 */
export const SHARE_FRAGMENT_KEY = 'bl-search';

/** 拡張を入れていない相手にも開けるページ。共有 URL の土台 */
const SHARE_BASE_PATH = '/dashboard';

/**
 * ページから来た値。フラグメントは誰でも書けるので、どのスペースの鍵を使うかの選択には使わない
 * （I7・tech-stack §2）。鍵の選択は拡張ページが自分で読んだタブ URL で行う
 */
export type FromPage<T> = { readonly origin: 'page'; readonly value: T };

export type DecodeResult =
  | { ok: true; shared: FromPage<SearchState> }
  | { ok: false; reason: 'notPresent' | 'malformed' | 'unsupportedVersion' };

const malformed: DecodeResult = { ok: false, reason: 'malformed' };

/** 既定値の条件は載せない。復元側がスキーマの既定値で補う */
function payloadOf(state: SearchState): Record<string, unknown> {
  const conditions: Record<string, unknown> = {};
  if (state.conditions.type !== 'all') conditions.type = state.conditions.type;
  if (state.conditions.status.kind !== 'all') conditions.status = state.conditions.status;
  if (state.conditions.assignee !== 'all') conditions.assignee = state.conditions.assignee;
  if (state.conditions.updated !== 'any') conditions.updated = state.conditions.updated;
  const payload: Record<string, unknown> = { v: state.v, query: state.query, scope: state.scope };
  if (Object.keys(conditions).length > 0) payload.conditions = conditions;
  return payload;
}

/** btoa は Latin-1 しか受けないので、UTF-8 のバイト列を 1 バイト 1 文字に詰め替える */
function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let latin1 = '';
  for (const byte of bytes) latin1 += String.fromCodePoint(byte);
  return btoa(latin1).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function fromBase64Url(payload: string): string | undefined {
  try {
    const latin1 = atob(payload.replaceAll('-', '+').replaceAll('_', '/'));
    const bytes = Uint8Array.from(latin1, (char) => char.codePointAt(0) ?? 0);
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return undefined;
  }
}

function parseJson(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    return undefined;
  }
}

export function encodeSearchState(state: SearchState): string {
  return toBase64Url(JSON.stringify(payloadOf(state)));
}

function payloadIn(input: string): string | undefined {
  const hash = input.indexOf('#');
  if (hash === -1) return undefined;
  for (const part of input.slice(hash + 1).split('&')) {
    const [key, ...rest] = part.split('=');
    if (key === SHARE_FRAGMENT_KEY && rest.length > 0) return rest.join('=');
  }
  return undefined;
}

function versionOf(value: unknown): number | undefined {
  if (typeof value !== 'object' || value === null || !('v' in value)) return undefined;
  return typeof value.v === 'number' ? value.v : undefined;
}

/** URL 全体、または location.hash を受けて復元する */
export function decodeSearchState(input: string): DecodeResult {
  const payload = payloadIn(input);
  if (payload === undefined || payload === '') return { ok: false, reason: 'notPresent' };
  const json = fromBase64Url(payload);
  if (json === undefined) return malformed;
  const raw = parseJson(json);
  const version = versionOf(raw);
  if (version === undefined) return malformed;
  if (version !== SEARCH_STATE_VERSION) return { ok: false, reason: 'unsupportedVersion' };
  const parsed = searchStateSchema.safeParse(raw);
  return parsed.success ? { ok: true, shared: { origin: 'page', value: parsed.data } } : malformed;
}

export function buildShareUrl(spaceOrigin: string, state: SearchState): string {
  const base = spaceOrigin.replace(/\/+$/u, '');
  return `${base}${SHARE_BASE_PATH}#${SHARE_FRAGMENT_KEY}=${encodeSearchState(state)}`;
}
