import { normalize } from './normalize.ts';

/**
 * 入力の解釈（実装プラン §7.1）。
 *
 * プレフィックスは任意の加速装置であって前提にしない（P1）。既定は自動判定で、
 * 記号を打たなくても同じ候補に辿り着ける。
 */

export type QueryIntent =
  | { kind: 'empty' }
  /** `PROJ-123`。スペース横断で直接ジャンプする */
  | { kind: 'issueKey'; projectKey: string; number: number; raw: string }
  /** 数字だけ。現在プロジェクトの課題として補完する */
  | { kind: 'issueNumber'; number: number }
  /** 加速プレフィックス付き */
  | { kind: 'scoped'; scope: 'command' | 'user' | 'project'; term: string }
  /** 特定スペースの指定 */
  | { kind: 'space'; spaceKey: string; term: string }
  | { kind: 'text'; term: string };

/*
 * プロジェクトキーの文字種は Backlog の仕様に合わせる（docs/backlog-facts.md）。
 * 小文字を受け付けないのは、`proj-123` を課題キーと解釈すると
 * 「proj-123 という語を検索したい」入力を奪ってしまうため。
 * 大文字で打つ習慣がキーで会話する文化と一致している。
 */
const ISSUE_KEY = /^([A-Z][A-Z0-9_]*)-(\d+)$/;
const ISSUE_NUMBER = /^(\d+)$/;
const SPACE_PREFIX = /^space:(\S+)\s*(.*)$/i;

/**
 * 加速プレフィックス。全角も受理する（P4）。
 *
 * 正規化を通す前に判定すると全角記号を取りこぼし、正規化した後だと
 * 課題キーの大文字が失われる。記号だけ先に畳んで、本体は生のまま扱う。
 */
const PREFIX_SCOPES: Record<string, 'command' | 'user' | 'project'> = {
  '>': 'command',
  '@': 'user',
  '#': 'project',
};

function foldSymbol(char: string): string {
  return char.normalize('NFKC');
}

export function parseQuery(input: string): QueryIntent {
  const trimmed = input.trim();
  if (trimmed === '') return { kind: 'empty' };

  const first = foldSymbol([...trimmed][0] ?? '');
  const scope = PREFIX_SCOPES[first];
  if (scope !== undefined) {
    return { kind: 'scoped', scope, term: trimmed.slice(1).trim() };
  }

  const space = SPACE_PREFIX.exec(trimmed);
  if (space?.[1] !== undefined) {
    return { kind: 'space', spaceKey: space[1], term: (space[2] ?? '').trim() };
  }

  const issueKey = ISSUE_KEY.exec(trimmed);
  if (issueKey?.[1] !== undefined && issueKey[2] !== undefined) {
    return {
      kind: 'issueKey',
      projectKey: issueKey[1],
      number: Number.parseInt(issueKey[2], 10),
      raw: trimmed,
    };
  }

  const issueNumber = ISSUE_NUMBER.exec(trimmed);
  if (issueNumber?.[1] !== undefined) {
    return { kind: 'issueNumber', number: Number.parseInt(issueNumber[1], 10) };
  }

  return { kind: 'text', term: trimmed };
}

/** 一致に使う語。課題キー判定を通した後なので、ここでは畳んでよい */
export function searchTerm(intent: QueryIntent): string {
  switch (intent.kind) {
    case 'empty':
      return '';
    case 'issueKey':
      return normalize(intent.raw);
    case 'issueNumber':
      return String(intent.number);
    case 'scoped':
    case 'space':
      return normalize(intent.term);
    case 'text':
      return normalize(intent.term);
  }
}
