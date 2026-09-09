import { match } from '../match/match.ts';
import { normalize } from '../query/normalize.ts';
import { parseQuery } from '../query/parse.ts';
import { type Candidate, type MatchKind, rankWithinSection } from '../rank/rank.ts';
import type { RowKind, RowView } from '../view/types.ts';

/**
 * 入力から候補セクションを組み立てる（docs/implementation-plan.md §5.1 A2〜A8 / §7.1 / §7.3）。
 *
 * 索引はモーダルがローカルに持つものだけを見る。URL の組み立ても API 呼び出しも
 * 呼び出し側の責務で、ここは「何をどの順で並べるか」だけを決める。
 */

/** モーダルがローカルで持つ索引の 1 件 */
export type IndexEntry = {
  id: string;
  kind: RowKind;
  /** 一致の対象になる主テキスト（ページ名・件名・プロジェクト名など） */
  text: string;
  /** 別名。日本語プロジェクト名に対する英字プロジェクトキーなど */
  aliases?: readonly string[];
  /** 行の副テキスト */
  sub?: string;
  /** 等幅で出す短い識別子（課題キーなど） */
  code?: string;
  context: 'currentProject' | 'currentSpace' | 'other';
  /** 全スペース表示時の出自バッジ */
  spaceKey?: string;
};

export type CandidateLabels = {
  searchInPanel: (term: string) => string;
  searchInPanelSub: string;
  openIssueDirectly: string;
  openIssueDirectlySub: (projectKey: string) => string;
  sectionRecent: string;
  sectionPages: string;
  sectionCommands: string;
  sectionPrefixMatch: string;
};

export type CandidateLimits = { perSection?: number; total?: number };

export type BuildOptions = {
  input: string;
  index: readonly IndexEntry[];
  /** frecency の材料。entryId は IndexEntry.id に対応する */
  frecencyOf: (entryId: string) => number;
  labels: CandidateLabels;
  /** 現在のスコープ。全スペース時は行に spaceKey のバッジを出す */
  showSpaceBadges: boolean;
  limits?: CandidateLimits;
};

export type CandidateRow = RowView & { id: string };

export type CandidateSection = {
  id: string;
  label?: string;
  meta?: string;
  rows: readonly CandidateRow[];
};

/** §13。セクションあたり 5 行・全体 12 行で打ち切り、続きは `hint: 'more'` へ逃がす */
export const DEFAULT_LIMITS = { perSection: 5, total: 12 } as const;

export const SECTION_PINNED = 'pinned';
export const SECTION_ISSUE_PREFIX = 'issuePrefix';
export const SECTION_PAGES = 'pages';
export const SECTION_COMMANDS = 'commands';

const SCOPE_KIND: Record<'command' | 'user' | 'project', RowKind> = {
  command: 'command',
  user: 'user',
  project: 'project',
};

const PROJECT_KEY = /^[A-Z][A-Z0-9_]*$/;
const ISSUE_CODE = /^([A-Z][A-Z0-9_]*)-\d+$/;

export function buildCandidates(options: BuildOptions): CandidateSection[] {
  return withSelection(withLimits(sectionsFor(options), options.limits ?? {}));
}

function sectionsFor(options: BuildOptions): CandidateSection[] {
  const intent = parseQuery(options.input);

  switch (intent.kind) {
    case 'empty':
      return [];
    case 'issueKey':
      return issueKeySections(intent.raw, intent.projectKey, options);
    case 'issueNumber': {
      const projectKey = currentProjectKey(options.index);
      const digits = String(intent.number);
      return projectKey === undefined
        ? freeTextSections(digits, options.index, options)
        : issueKeySections(`${projectKey}-${digits}`, projectKey, options);
    }
    case 'scoped':
      return scopedSections(SCOPE_KIND[intent.scope], intent.term, options);
    case 'space':
    case 'text':
      return freeTextSections(intent.term, options.index, options);
  }
}

/**
 * 直接ジャンプ行はランキングを通さない。索引に無い課題でも打てば飛べることと、
 * 個人化で位置が動かないこと（§7.3 不変条件 1）を、並べ替えの外に置いて保証する。
 */
function issueKeySections(
  issueKey: string,
  projectKey: string,
  options: BuildOptions,
): CandidateSection[] {
  const { labels } = options;
  const pinned: CandidateSection = {
    id: SECTION_PINNED,
    rows: [
      {
        id: `openIssue:${issueKey}`,
        kind: 'issue',
        code: issueKey,
        title: labels.openIssueDirectly,
        sub: labels.openIssueDirectlySub(projectKey),
        tone: 'accent',
        hint: 'enter',
      },
    ],
  };

  const prefixed = sectionOf(
    SECTION_ISSUE_PREFIX,
    labels.sectionPrefixMatch,
    scoreByCode(issueKey, options),
    options,
  );

  return [pinned, ...prefixed];
}

function freeTextSections(
  term: string,
  entries: readonly IndexEntry[],
  options: BuildOptions,
): CandidateSection[] {
  if (term === '') return [];

  const pinned: CandidateSection = {
    id: SECTION_PINNED,
    rows: [
      {
        id: 'searchInPanel',
        kind: 'filter',
        title: options.labels.searchInPanel(term),
        sub: options.labels.searchInPanelSub,
        tone: 'accent',
        hint: 'enter',
      },
    ],
  };

  return [pinned, ...localSections(scoreByText(term, entries, options), options)];
}

function scopedSections(kind: RowKind, term: string, options: BuildOptions): CandidateSection[] {
  const entries = options.index.filter((entry) => entry.kind === kind);
  if (term === '') return localSections(unscored(entries, options), options);

  return freeTextSections(term, entries, options);
}

type Scored = { entry: IndexEntry; candidate: Candidate };

function localSections(scored: readonly Scored[], options: BuildOptions): CandidateSection[] {
  const { labels } = options;
  const commands = scored.filter(({ entry }) => entry.kind === 'command');
  const pages = scored.filter(({ entry }) => entry.kind !== 'command');

  return [
    ...sectionOf(SECTION_PAGES, labels.sectionPages, pages, options),
    ...sectionOf(SECTION_COMMANDS, labels.sectionCommands, commands, options),
  ];
}

function sectionOf(
  id: string,
  label: string,
  scored: readonly Scored[],
  options: BuildOptions,
): CandidateSection[] {
  if (scored.length === 0) return [];

  const entries = new Map(scored.map(({ entry, candidate }) => [candidate.id, entry]));
  const rows = rankWithinSection(scored.map(({ candidate }) => candidate)).flatMap((candidate) => {
    const entry = entries.get(candidate.id);
    return entry === undefined ? [] : [rowOf(entry, options)];
  });

  return [{ id, label, rows }];
}

function scoreByText(
  term: string,
  entries: readonly IndexEntry[],
  options: BuildOptions,
): Scored[] {
  const exact = exactScoreOf(term);
  if (exact === 0) return [];

  return entries.flatMap((entry) => {
    const { score } = match(term, targetOf(entry));
    if (score === 0) return [];

    const kind: MatchKind =
      entry.kind === 'command' && score === exact ? 'exactCommand' : 'partial';
    return [{ entry, candidate: candidateOf(entry, score / exact, kind, options) }];
  });
}

function scoreByCode(issueKey: string, options: BuildOptions): Scored[] {
  const exact = exactScoreOf(issueKey);
  if (exact === 0) return [];

  const wanted = normalize(issueKey);
  return options.index.flatMap((entry) => {
    if (entry.code === undefined || !normalize(entry.code).startsWith(wanted)) return [];

    const { score } = match(issueKey, { text: entry.code });
    const kind: MatchKind = score === exact ? 'exactIssueKey' : 'partial';
    return [{ entry, candidate: candidateOf(entry, score / exact, kind, options) }];
  });
}

function unscored(entries: readonly IndexEntry[], options: BuildOptions): Scored[] {
  return entries.map((entry) => ({ entry, candidate: candidateOf(entry, 0, 'partial', options) }));
}

/**
 * 一致点を 0〜1 に写す基準を、その語を自分自身に当てて測る。完全一致の点数は
 * match.ts の内部定数で公開されていないので、写した定数を持つとあちらの帯を
 * 動かしたときに黙って 1 を超え、rank の帯（MATCH_SCORE_TIE_BAND）が狂う。
 */
function exactScoreOf(term: string): number {
  return match(term, { text: term }).score;
}

function candidateOf(
  entry: IndexEntry,
  matchScore: number,
  matchKind: MatchKind,
  options: BuildOptions,
): Candidate {
  return {
    id: entry.id,
    matchScore,
    matchKind,
    frecency: options.frecencyOf(entry.id),
    context: entry.context,
  };
}

function targetOf(entry: IndexEntry): { text: string; aliases?: readonly string[] } {
  return {
    text: entry.text,
    ...(entry.aliases === undefined ? {} : { aliases: entry.aliases }),
  };
}

function rowOf(entry: IndexEntry, options: BuildOptions): CandidateRow {
  return {
    id: entry.id,
    kind: entry.kind,
    title: entry.text,
    hint: 'enter',
    ...(entry.code === undefined ? {} : { code: entry.code }),
    ...(entry.sub === undefined ? {} : { sub: entry.sub }),
    ...(options.showSpaceBadges && entry.spaceKey !== undefined
      ? { avatar: { label: entry.spaceKey } }
      : {}),
  };
}

/** 数字だけの入力を補完する先。索引の課題キーか、プロジェクトキーの別名から拾う */
function currentProjectKey(index: readonly IndexEntry[]): string | undefined {
  for (const entry of index) {
    if (entry.context !== 'currentProject') continue;
    if (entry.kind !== 'project' && entry.kind !== 'issue') continue;

    for (const code of [entry.code, ...(entry.aliases ?? [])]) {
      const key = projectKeyOf(code);
      if (key !== undefined) return key;
    }
  }
  return undefined;
}

function projectKeyOf(code: string | undefined): string | undefined {
  if (code === undefined) return undefined;
  if (PROJECT_KEY.test(code)) return code;
  return ISSUE_CODE.exec(code)?.[1];
}

function withLimits(
  sections: readonly CandidateSection[],
  limits: CandidateLimits,
): CandidateSection[] {
  const perSection = limits.perSection ?? DEFAULT_LIMITS.perSection;
  const total = limits.total ?? DEFAULT_LIMITS.total;

  const kept: CandidateSection[] = [];
  let remaining = total;
  let droppedWholeSection = false;

  for (const section of sections) {
    const allowance = Math.min(perSection, remaining);
    if (allowance <= 0) {
      droppedWholeSection = droppedWholeSection || section.rows.length > 0;
      continue;
    }

    const rows = section.rows.slice(0, allowance);
    remaining -= rows.length;
    kept.push({ ...section, rows: rows.length < section.rows.length ? withMoreHint(rows) : rows });
  }

  return droppedWholeSection ? markLastAsMore(kept) : kept;
}

/**
 * 全体の上限でセクションごと落ちたときは、残った末尾の行に続きがあることを示す。
 * 固定行のセクションだけは書き換えない。あの行のヒントは「押せば開く」であって、
 * 続きの入口ではない（§5.1 A3・A4）。
 */
function markLastAsMore(sections: readonly CandidateSection[]): CandidateSection[] {
  const last = sections[sections.length - 1];
  if (last === undefined || last.id === SECTION_PINNED) return [...sections];

  return [...sections.slice(0, -1), { ...last, rows: withMoreHint(last.rows) }];
}

function withMoreHint(rows: readonly CandidateRow[]): CandidateRow[] {
  const last = rows[rows.length - 1];
  if (last === undefined) return [...rows];

  return [...rows.slice(0, -1), { ...last, hint: 'more' }];
}

function withSelection(sections: readonly CandidateSection[]): CandidateSection[] {
  const [first, ...rest] = sections;
  if (first === undefined) return [...sections];

  const [head, ...others] = first.rows;
  if (head === undefined) return [...sections];

  return [{ ...first, rows: [{ ...head, selected: true }, ...others] }, ...rest];
}
