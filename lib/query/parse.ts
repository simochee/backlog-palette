/**
 * 入力の解釈（palette.md §4）。打鍵に同期して判定し、API は叩かない。
 * プレフィックスは加速装置であって前提ではない（P1）。
 */
export type QueryIntent =
  | { kind: 'empty' }
  /** `PROJ-123`。key は大文字化した正規形で、表示と遷移はこれを使う */
  | { kind: 'issueKey'; key: string; projectKey: string; number: number }
  /** 数字だけ。現在プロジェクトの課題番号として補完する */
  | { kind: 'issueNumber'; key: string; projectKey: string; number: number }
  | { kind: 'commands'; term: string }
  | { kind: 'projects'; term: string }
  | { kind: 'text'; term: string };

export type ParseContext = {
  /** スコープが [space / project] のときのプロジェクトキー */
  currentProjectKey?: string;
  /** ローカル索引にある実在のプロジェクトキー（大文字）。小文字入力の確定に使う */
  knownProjectKeys?: ReadonlySet<string>;
};

/*
 * 文字種は緩く見て実在キーとの突き合わせで確定させる（backlog-facts.md §2.2）。
 * 大文字で打った形は索引に無くても課題キーとして扱う。索引はキャッシュなので、
 * まだ載っていないプロジェクトの課題へ直接飛べないのは困る。
 * 小文字は「proj-123 という語を検索したい」入力を奪わないよう、索引で確定したときだけ。
 */
const ISSUE_KEY_CANDIDATE = /^([A-Za-z][A-Za-z0-9_]*)-(\d+)$/u;
const ISSUE_NUMBER = /^\d+$/u;

const PREFIXES: Record<string, 'commands' | 'projects'> = { '>': 'commands', '#': 'projects' };

function isUppercase(projectKey: string): boolean {
  return projectKey === projectKey.toUpperCase();
}

function parseIssueKey(input: string, context: ParseContext): QueryIntent | undefined {
  const found = ISSUE_KEY_CANDIDATE.exec(input);
  if (found?.[1] === undefined || found[2] === undefined) return undefined;

  const projectKey = found[1].toUpperCase();
  const confirmed = isUppercase(found[1]) || (context.knownProjectKeys?.has(projectKey) ?? false);
  if (!confirmed) return undefined;

  const number = Number(found[2]);
  return { kind: 'issueKey', key: `${projectKey}-${number}`, projectKey, number };
}

/**
 * 全角の記号は半角として受理する（P4・§13）。NFKC は課題キーの大文字小文字を保つので、
 * 課題キーの判定を原文で行う要件（§2.2）と両立する。
 */
export function parseQuery(input: string, context: ParseContext = {}): QueryIntent {
  const trimmed = input.normalize('NFKC').trim();
  if (trimmed === '') return { kind: 'empty' };

  const prefix = PREFIXES[trimmed.charAt(0)];
  if (prefix !== undefined) return { kind: prefix, term: trimmed.slice(1).trim() };

  const issueKey = parseIssueKey(trimmed, context);
  if (issueKey !== undefined) return issueKey;

  if (ISSUE_NUMBER.test(trimmed) && context.currentProjectKey !== undefined) {
    const number = Number(trimmed);
    const projectKey = context.currentProjectKey;
    return { kind: 'issueNumber', key: `${projectKey}-${number}`, projectKey, number };
  }

  return { kind: 'text', term: trimmed };
}
