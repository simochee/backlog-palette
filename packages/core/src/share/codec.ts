import {
  type AssigneeFilter,
  defaultSearchState,
  type KeywordTarget,
  SEARCH_STATE_VERSION,
  type SearchResultType,
  type SearchScope,
  type SearchState,
  type StatusFilter,
  type UpdatedFilter,
} from './searchState.ts';

/**
 * 条件はスペースキー・プロジェクトキー・担当者 ID を含む。クエリパラメータに載せると
 * リクエストに乗ってサーバーのアクセスログと Referer に残るが、フラグメントは送られない。
 * 共有リンクを踏んだだけで誰の検索条件かが Backlog 側に記録されないこと、
 * および拡張なしでも素の Backlog ページとして開けること（§7.5）が、
 * この非送信性の上に成り立っている。クエリパラメータへ移すと両方が壊れる。
 */
export const SHARE_FRAGMENT_KEY = 'bl-search';

/** 拡張を入れていない相手にも普通に開けるページ。共有 URL の土台にする（§7.5） */
const SHARE_BASE_PATH = '/dashboard';

export function encodeSearchState(state: SearchState): string {
  return toBase64Url(new TextEncoder().encode(JSON.stringify(withoutDefaults(state))));
}

export type DecodeResult =
  | { ok: true; state: SearchState }
  | { ok: false; reason: 'notPresent' | 'malformed' | 'unsupportedVersion'; version?: number };

const malformed: DecodeResult = { ok: false, reason: 'malformed' };

/** URL 全体、または `location.hash` を受けて復元する */
export function decodeSearchState(input: string): DecodeResult {
  const payload = payloadIn(input);
  if (payload === undefined) return { ok: false, reason: 'notPresent' };

  const json = utf8Of(fromBase64Url(payload));
  if (json === undefined) return malformed;

  const record = asRecord(parseJson(json));
  if (record === undefined) return malformed;

  const version = asNumber(record.v);
  if (version === undefined) return malformed;
  if (version !== SEARCH_STATE_VERSION) return { ok: false, reason: 'unsupportedVersion', version };

  return stateOf(record);
}

export function buildShareUrl(origin: string, state: SearchState): string {
  const base = origin.replace(/\/+$/, '');
  return `${base}${SHARE_BASE_PATH}#${SHARE_FRAGMENT_KEY}=${encodeSearchState(state)}`;
}

/** 既定値のフィールドは載せない。復元側が既定値で補う */
function withoutDefaults(state: SearchState): Record<string, unknown> {
  const payload: Record<string, unknown> = { v: state.v };

  if (state.query !== defaultSearchState.query) payload.query = state.query;
  if (state.scope.kind !== 'allSpaces') payload.scope = state.scope;
  if (!sameTypes(state.types, defaultSearchState.types)) payload.types = state.types;
  if (state.status.kind !== 'any') payload.status = state.status;
  if (state.assignee.kind !== 'any') payload.assignee = state.assignee;
  if (state.issueTypeId !== undefined) payload.issueTypeId = state.issueTypeId;
  if (state.updated.kind !== 'any') payload.updated = state.updated;
  if (state.keywordTarget !== defaultSearchState.keywordTarget) {
    payload.keywordTarget = state.keywordTarget;
  }

  return payload;
}

function sameTypes(a: readonly SearchResultType[], b: readonly SearchResultType[]): boolean {
  return a.length === b.length && a.every((type, i) => type === b[i]);
}

function stateOf(record: Record<string, unknown>): DecodeResult {
  const query = record.query === undefined ? defaultSearchState.query : asString(record.query);
  const scope = withDefault(record.scope, defaultSearchState.scope, parseScope);
  const types = withDefault(record.types, defaultSearchState.types, parseTypes);
  const status = withDefault(record.status, defaultSearchState.status, parseStatus);
  const assignee = withDefault(record.assignee, defaultSearchState.assignee, parseAssignee);
  const updated = withDefault(record.updated, defaultSearchState.updated, parseUpdated);
  const keywordTarget = withDefault(
    record.keywordTarget,
    defaultSearchState.keywordTarget,
    parseKeywordTarget,
  );
  const issueTypeId =
    record.issueTypeId === undefined ? undefined : asPositiveInteger(record.issueTypeId);

  if (query === undefined) return malformed;
  if (scope === undefined) return malformed;
  if (types === undefined) return malformed;
  if (status === undefined) return malformed;
  if (assignee === undefined) return malformed;
  if (updated === undefined) return malformed;
  if (keywordTarget === undefined) return malformed;
  if (record.issueTypeId !== undefined && issueTypeId === undefined) return malformed;

  return {
    ok: true,
    state: {
      v: SEARCH_STATE_VERSION,
      query,
      scope,
      types,
      status,
      assignee,
      updated,
      keywordTarget,
      ...(issueTypeId === undefined ? {} : { issueTypeId }),
    },
  };
}

function withDefault<T>(
  value: unknown,
  fallback: T,
  parse: (value: unknown) => T | undefined,
): T | undefined {
  return value === undefined ? fallback : parse(value);
}

function parseScope(value: unknown): SearchScope | undefined {
  const record = asRecord(value);
  if (record === undefined) return undefined;

  const spaceKey = asNonEmptyString(record.spaceKey);
  const projectKey = asNonEmptyString(record.projectKey);

  switch (asString(record.kind)) {
    case 'allSpaces':
      return { kind: 'allSpaces' };
    case 'space':
      return spaceKey === undefined ? undefined : { kind: 'space', spaceKey };
    case 'project':
      return spaceKey === undefined || projectKey === undefined
        ? undefined
        : { kind: 'project', spaceKey, projectKey };
    default:
      return undefined;
  }
}

function parseTypes(value: unknown): readonly SearchResultType[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const types: SearchResultType[] = [];
  for (const entry of value) {
    switch (asString(entry)) {
      case 'issue':
        types.push('issue');
        break;
      case 'wiki':
        types.push('wiki');
        break;
      case 'document':
        types.push('document');
        break;
      default:
        return undefined;
    }
  }
  return types;
}

function parseStatus(value: unknown): StatusFilter | undefined {
  const record = asRecord(value);
  if (record === undefined) return undefined;

  switch (asString(record.kind)) {
    case 'any':
      return { kind: 'any' };
    case 'status': {
      const statusId = asPositiveInteger(record.statusId);
      return statusId === undefined ? undefined : { kind: 'status', statusId };
    }
    case 'preset':
      return asString(record.preset) === 'openOnly'
        ? { kind: 'preset', preset: 'openOnly' }
        : undefined;
    default:
      return undefined;
  }
}

function parseAssignee(value: unknown): AssigneeFilter | undefined {
  const record = asRecord(value);
  if (record === undefined) return undefined;

  switch (asString(record.kind)) {
    case 'any':
      return { kind: 'any' };
    case 'me':
      return { kind: 'me' };
    case 'user': {
      const userId = asPositiveInteger(record.userId);
      return userId === undefined ? undefined : { kind: 'user', userId };
    }
    default:
      return undefined;
  }
}

function parseUpdated(value: unknown): UpdatedFilter | undefined {
  const record = asRecord(value);
  if (record === undefined) return undefined;

  switch (asString(record.kind)) {
    case 'any':
      return { kind: 'any' };
    case 'withinDays': {
      const days = asPositiveInteger(record.days);
      return days === undefined ? undefined : { kind: 'withinDays', days };
    }
    default:
      return undefined;
  }
}

function parseKeywordTarget(value: unknown): KeywordTarget | undefined {
  switch (asString(value)) {
    case 'subject':
      return 'subject';
    case 'subjectAndBody':
      return 'subjectAndBody';
    case 'subjectBodyAndComment':
      return 'subjectBodyAndComment';
    default:
      return undefined;
  }
}

function payloadIn(input: string): string | undefined {
  const hash = input.indexOf('#');
  if (hash === -1) return undefined;

  for (const part of input.slice(hash + 1).split('&')) {
    const separator = part.indexOf('=');
    if (separator !== -1 && part.slice(0, separator) === SHARE_FRAGMENT_KEY) {
      return part.slice(separator + 1);
    }
  }
  return undefined;
}

/**
 * `btoa` は Latin-1 しか受け取れず、日本語のクエリをそのまま渡すと例外になる。
 * UTF-8 のバイト列に落としてから 1 バイト 1 文字の文字列に詰め替える。
 */
function toBase64Url(bytes: Uint8Array): string {
  let latin1 = '';
  for (const byte of bytes) latin1 += String.fromCharCode(byte);

  return btoa(latin1).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function fromBase64Url(payload: string): Uint8Array | undefined {
  if (payload === '') return undefined;

  try {
    const latin1 = atob(payload.replaceAll('-', '+').replaceAll('_', '/'));
    const bytes = new Uint8Array(latin1.length);
    for (let i = 0; i < latin1.length; i += 1) bytes[i] = latin1.charCodeAt(i);
    return bytes;
  } catch {
    return undefined;
  }
}

function utf8Of(bytes: Uint8Array | undefined): string | undefined {
  if (bytes === undefined) return undefined;

  try {
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

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function asPositiveInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined;
}
