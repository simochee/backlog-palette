import { defaultSearchState, type SearchState } from '@backlog-palette/core';
import { describe, expect, it } from 'vitest';
import type { SpaceConnection } from '../../storage/schema.ts';
import type { SpaceCredential } from '../auth/credentials.ts';
import { type BacklogClient, BacklogRequestError, spaceKeyFromHost } from '../backlog/index.ts';
import type {
  BacklogDocument,
  BacklogIssue,
  BacklogProject,
  BacklogWiki,
  DocumentSearchParams,
  IssueSearchParams,
  WikiSearchParams,
} from '../backlog/types.ts';
import {
  runSearch,
  type SearchChunk,
  type SearchDeps,
  WIKI_PROJECT_CONCURRENCY,
} from './search.ts';

const NOW = Date.UTC(2026, 8, 10, 12, 0, 0);
const MY_USER_ID = 42;

const USER = { id: 7, name: '田中' };

const NULAB: SpaceConnection = {
  spaceKey: 'nulab',
  host: 'nulab.backlog.jp',
  method: 'apiKey',
  displayName: 'nulab',
  state: 'connected',
};

const ACME: SpaceConnection = {
  spaceKey: 'acme',
  host: 'acme.backlog.jp',
  method: 'apiKey',
  displayName: 'acme',
  state: 'connected',
};

function project(overrides: Partial<BacklogProject> = {}): BacklogProject {
  return {
    id: 1,
    projectKey: 'PROJ',
    name: 'パレット',
    archived: false,
    displayOrder: 0,
    useWiki: true,
    ...overrides,
  };
}

function issue(overrides: Partial<BacklogIssue> = {}): BacklogIssue {
  return {
    id: 1,
    projectId: 1,
    issueKey: 'PROJ-1',
    keyId: 1,
    summary: '検索の設計',
    description: '本文',
    issueType: { id: 1, projectId: 1, name: 'タスク', color: '#7ea800' },
    status: { id: 1, projectId: 1, name: '未対応', color: '#ed8077', displayOrder: 1000 },
    priority: { id: 2, name: '中' },
    createdUser: USER,
    created: '2026-09-01T00:00:00Z',
    updatedUser: USER,
    updated: '2026-09-09T00:00:00Z',
    ...overrides,
  };
}

function wiki(overrides: Partial<BacklogWiki> = {}): BacklogWiki {
  return {
    id: 100,
    projectId: 1,
    name: '設計メモ',
    content: '本文',
    tags: [],
    createdUser: USER,
    created: '2026-09-01T00:00:00Z',
    updatedUser: USER,
    updated: '2026-09-08T00:00:00Z',
    ...overrides,
  };
}

function document(overrides: Partial<BacklogDocument> = {}): BacklogDocument {
  return {
    id: 'doc-1',
    projectId: 1,
    title: '仕様',
    plain: '本文',
    statusId: 1,
    tags: [],
    createdUser: USER,
    created: '2026-09-01T00:00:00Z',
    updatedUser: USER,
    updated: '2026-09-07T00:00:00Z',
    ...overrides,
  };
}

type StubSpec = {
  projects?: readonly BacklogProject[];
  issues?: readonly BacklogIssue[];
  wikis?: readonly BacklogWiki[];
  documents?: readonly BacklogDocument[];
  /** 解決するまで応答を返さない。遅いスペースを表す */
  gate?: Promise<void>;
  failWith?: BacklogRequestError;
};

type Stub = {
  client: BacklogClient;
  issueCalls: IssueSearchParams[];
  wikiCalls: WikiSearchParams[];
  documentCalls: DocumentSearchParams[];
  peakWikiConcurrency: () => number;
};

function stubSpace(host: string, spec: StubSpec = {}): Stub {
  const issueCalls: IssueSearchParams[] = [];
  const wikiCalls: WikiSearchParams[] = [];
  const documentCalls: DocumentSearchParams[] = [];
  let inFlightWikis = 0;
  let peak = 0;

  const client: BacklogClient = {
    host,
    spaceKey: spaceKeyFromHost(host),
    get: async <T>() => ({ id: MY_USER_ID }) as unknown as T,
    projects: async () => {
      await spec.gate;
      if (spec.failWith !== undefined) throw spec.failWith;
      return spec.projects ?? [project()];
    },
    issues: async (params) => {
      issueCalls.push(params);
      return spec.issues ?? [];
    },
    wikis: async (params) => {
      wikiCalls.push(params);
      inFlightWikis += 1;
      peak = Math.max(peak, inFlightWikis);
      await new Promise((resolve) => setTimeout(resolve, 0));
      inFlightWikis -= 1;
      return spec.wikis ?? [];
    },
    documents: async (params) => {
      documentCalls.push(params);
      return spec.documents ?? [];
    },
    statuses: async () => [],
    rateLimit: async () => {
      throw new Error('検索は枠の実測を呼ばない');
    },
  };

  return { client, issueCalls, wikiCalls, documentCalls, peakWikiConcurrency: () => peak };
}

function depsFor(
  stubs: Record<string, Stub>,
  options: {
    connections?: readonly SpaceConnection[];
    credentials?: Record<string, SpaceCredential | undefined>;
  } = {},
): SearchDeps {
  const connections = options.connections ?? [NULAB, ACME];

  return {
    listConnections: async () => connections,
    credentialFor: async (spaceKey) =>
      options.credentials === undefined
        ? { method: 'apiKey', apiKey: 'key' }
        : options.credentials[spaceKey],
    createClient: (host) => {
      const stub = stubs[host];
      if (stub === undefined) throw new Error(`未登録のホスト: ${host}`);
      return stub.client;
    },
  };
}

function searchState(overrides: Partial<SearchState> = {}): SearchState {
  return {
    ...defaultSearchState,
    query: '設計',
    keywordTarget: 'subjectBodyAndComment',
    ...overrides,
  };
}

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let settle: (() => void) | undefined;
  const promise = new Promise<void>((resolve) => {
    settle = resolve;
  });

  return { promise, resolve: () => settle?.() };
}

/** 遅延させていないスペースが返り切るまで待つ */
async function settleImmediateSpaces(): Promise<void> {
  for (let round = 0; round < 8; round += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

function collect(): { chunks: SearchChunk[]; onChunk: (chunk: SearchChunk) => void } {
  const chunks: SearchChunk[] = [];
  return { chunks, onChunk: (chunk) => chunks.push(chunk) };
}

const doneOf = (chunks: readonly SearchChunk[], spaceKey: string) =>
  chunks.find((chunk) => chunk.spaceKey === spaceKey && chunk.state === 'done');

const errorOf = (chunks: readonly SearchChunk[], spaceKey: string) =>
  chunks.find((chunk) => chunk.spaceKey === spaceKey && chunk.state === 'error');

function rowsOf(chunks: readonly SearchChunk[], spaceKey: string) {
  const done = doneOf(chunks, spaceKey);
  return done?.state === 'done' ? done.rows : [];
}

describe('スペース単位の独立', () => {
  it('1 つのスペースが認証切れでも、他のスペースの結果は届く', async () => {
    const stubs = {
      'nulab.backlog.jp': stubSpace('nulab.backlog.jp', { issues: [issue()] }),
      'acme.backlog.jp': stubSpace('acme.backlog.jp', {
        failWith: new BacklogRequestError({
          kind: 'unauthorized',
          spaceKey: 'acme',
          retryable: false,
        }),
      }),
    };
    const { chunks, onChunk } = collect();

    await runSearch(searchState(), onChunk, { deps: depsFor(stubs), now: () => NOW });

    expect(errorOf(chunks, 'acme')).toMatchObject({ error: { kind: 'unauthorized' } });
    expect(doneOf(chunks, 'nulab')).toMatchObject({ total: 1 });
  });

  it('レート超過はそのスペースのエラーになり、他スペースを止めない', async () => {
    const stubs = {
      'nulab.backlog.jp': stubSpace('nulab.backlog.jp', { issues: [issue()] }),
      'acme.backlog.jp': stubSpace('acme.backlog.jp', {
        failWith: new BacklogRequestError({
          kind: 'rateLimited',
          spaceKey: 'acme',
          retryable: true,
          retryAt: NOW + 400,
        }),
      }),
    };
    const { chunks, onChunk } = collect();

    await runSearch(searchState(), onChunk, { deps: depsFor(stubs), now: () => NOW });

    expect(errorOf(chunks, 'acme')).toMatchObject({
      error: { kind: 'rateLimited', retryAt: NOW + 400 },
    });
    expect(doneOf(chunks, 'nulab')).toMatchObject({ total: 1 });
  });

  it('行内に出し分けられない失敗はまとめて 1 種類として返す', async () => {
    const stubs = {
      'nulab.backlog.jp': stubSpace('nulab.backlog.jp', {
        failWith: new BacklogRequestError({
          kind: 'notFound',
          spaceKey: 'nulab',
          retryable: false,
          status: 404,
        }),
      }),
    };
    const { chunks, onChunk } = collect();

    await runSearch(searchState(), onChunk, {
      deps: depsFor(stubs, { connections: [NULAB] }),
      now: () => NOW,
    });

    expect(errorOf(chunks, 'nulab')).toMatchObject({ error: { kind: 'unknown' } });
  });

  it('認証情報が残っていないスペースは、API を呼ばずに認証切れとして返す', async () => {
    const stubs = { 'nulab.backlog.jp': stubSpace('nulab.backlog.jp') };
    const { chunks, onChunk } = collect();

    await runSearch(searchState(), onChunk, {
      deps: depsFor(stubs, {
        connections: [NULAB],
        credentials: { nulab: undefined },
      }),
      now: () => NOW,
    });

    expect(errorOf(chunks, 'nulab')).toMatchObject({ error: { kind: 'unauthorized' } });
    expect(stubs['nulab.backlog.jp'].issueCalls).toEqual([]);
  });

  it('再接続待ちのスペースには問い合わせない', async () => {
    const stubs = { 'nulab.backlog.jp': stubSpace('nulab.backlog.jp') };
    const { chunks, onChunk } = collect();

    await runSearch(searchState(), onChunk, {
      deps: depsFor(stubs, { connections: [{ ...NULAB, state: 'needsReconnect' }] }),
      now: () => NOW,
    });

    expect(errorOf(chunks, 'nulab')).toMatchObject({ error: { kind: 'unauthorized' } });
    expect(stubs['nulab.backlog.jp'].issueCalls).toEqual([]);
  });
});

describe('チャンクの流れ方', () => {
  it('開始時に対象スペースぶんの読み込み中が流れる', async () => {
    const stubs = {
      'nulab.backlog.jp': stubSpace('nulab.backlog.jp'),
      'acme.backlog.jp': stubSpace('acme.backlog.jp'),
    };
    const { chunks, onChunk } = collect();

    await runSearch(searchState(), onChunk, { deps: depsFor(stubs), now: () => NOW });

    expect(chunks.slice(0, 2)).toEqual([
      { spaceKey: 'nulab', state: 'loading' },
      { spaceKey: 'acme', state: 'loading' },
    ]);
  });

  it('遅いスペースを待たず、返ってきた順に流れる', async () => {
    const slow = deferred();
    const stubs = {
      'nulab.backlog.jp': stubSpace('nulab.backlog.jp', { gate: slow.promise }),
      'acme.backlog.jp': stubSpace('acme.backlog.jp'),
    };
    const { chunks, onChunk } = collect();

    const running = runSearch(searchState(), onChunk, { deps: depsFor(stubs), now: () => NOW });
    await settleImmediateSpaces();

    expect(chunks.filter((chunk) => chunk.state === 'done').map((chunk) => chunk.spaceKey)).toEqual(
      ['acme'],
    );

    slow.resolve();
    await running;

    expect(chunks.filter((chunk) => chunk.state === 'done').map((chunk) => chunk.spaceKey)).toEqual(
      ['acme', 'nulab'],
    );
  });

  it('中断したら以降のチャンクは流れない', async () => {
    const slow = deferred();
    const controller = new AbortController();
    const stubs = {
      'nulab.backlog.jp': stubSpace('nulab.backlog.jp', { gate: slow.promise }),
      'acme.backlog.jp': stubSpace('acme.backlog.jp', { gate: slow.promise }),
    };
    const { chunks, onChunk } = collect();

    const running = runSearch(searchState(), onChunk, {
      deps: depsFor(stubs),
      now: () => NOW,
      signal: controller.signal,
    });
    await settleImmediateSpaces();
    controller.abort();
    slow.resolve();
    await running;

    expect(chunks.every((chunk) => chunk.state === 'loading')).toBe(true);
  });

  it('1 スペースが失敗しても検索全体は失敗しない', async () => {
    const stubs = {
      'nulab.backlog.jp': stubSpace('nulab.backlog.jp', {
        failWith: new BacklogRequestError({ kind: 'offline', spaceKey: 'nulab', retryable: true }),
      }),
      'acme.backlog.jp': stubSpace('acme.backlog.jp'),
    };
    const { onChunk } = collect();

    await expect(
      runSearch(searchState(), onChunk, { deps: depsFor(stubs), now: () => NOW }),
    ).resolves.toBeUndefined();
  });
});

describe('スコープの解釈', () => {
  it('全スペースでは接続済みのすべてを引く', async () => {
    const stubs = {
      'nulab.backlog.jp': stubSpace('nulab.backlog.jp'),
      'acme.backlog.jp': stubSpace('acme.backlog.jp'),
    };
    const { chunks, onChunk } = collect();

    await runSearch(searchState(), onChunk, { deps: depsFor(stubs), now: () => NOW });

    expect(new Set(chunks.map((chunk) => chunk.spaceKey))).toEqual(new Set(['nulab', 'acme']));
  });

  it('スペースを指定すると、そのスペースにしか問い合わせない', async () => {
    const stubs = {
      'nulab.backlog.jp': stubSpace('nulab.backlog.jp'),
      'acme.backlog.jp': stubSpace('acme.backlog.jp'),
    };
    const { chunks, onChunk } = collect();

    await runSearch(searchState({ scope: { kind: 'space', spaceKey: 'acme' } }), onChunk, {
      deps: depsFor(stubs),
      now: () => NOW,
    });

    expect(chunks.map((chunk) => chunk.spaceKey)).toEqual(['acme', 'acme']);
    expect(stubs['nulab.backlog.jp'].issueCalls).toEqual([]);
  });

  it('プロジェクトを指定すると、そのプロジェクトだけを引く', async () => {
    const stubs = {
      'nulab.backlog.jp': stubSpace('nulab.backlog.jp', {
        projects: [project(), project({ id: 2, projectKey: 'OTHER', name: 'ほか' })],
      }),
    };
    const { onChunk } = collect();

    await runSearch(
      searchState({ scope: { kind: 'project', spaceKey: 'nulab', projectKey: 'OTHER' } }),
      onChunk,
      { deps: depsFor(stubs, { connections: [NULAB] }), now: () => NOW },
    );

    expect(stubs['nulab.backlog.jp'].issueCalls[0]?.projectId).toEqual([2]);
    expect(stubs['nulab.backlog.jp'].wikiCalls.map((call) => call.projectIdOrKey)).toEqual([2]);
    expect(stubs['nulab.backlog.jp'].documentCalls[0]?.projectIds).toEqual([2]);
  });
});

describe('種別の引き分け', () => {
  it('選ばれていない種別は引かない', async () => {
    const stubs = { 'nulab.backlog.jp': stubSpace('nulab.backlog.jp') };
    const { onChunk } = collect();

    await runSearch(searchState({ types: ['issue'] }), onChunk, {
      deps: depsFor(stubs, { connections: [NULAB] }),
      now: () => NOW,
    });

    const stub = stubs['nulab.backlog.jp'];
    expect(stub.issueCalls).toHaveLength(1);
    expect(stub.wikiCalls).toEqual([]);
    expect(stub.documentCalls).toEqual([]);
  });

  it('Wiki はキーワードが無ければ引かない', async () => {
    const stubs = { 'nulab.backlog.jp': stubSpace('nulab.backlog.jp') };
    const { onChunk } = collect();

    await runSearch(searchState({ query: '   ' }), onChunk, {
      deps: depsFor(stubs, { connections: [NULAB] }),
      now: () => NOW,
    });

    expect(stubs['nulab.backlog.jp'].wikiCalls).toEqual([]);
    expect(stubs['nulab.backlog.jp'].issueCalls).toHaveLength(1);
  });

  it('Wiki を使わないプロジェクトには問い合わせない', async () => {
    const stubs = {
      'nulab.backlog.jp': stubSpace('nulab.backlog.jp', {
        projects: [project(), project({ id: 2, projectKey: 'NOWIKI', useWiki: false })],
      }),
    };
    const { onChunk } = collect();

    await runSearch(searchState(), onChunk, {
      deps: depsFor(stubs, { connections: [NULAB] }),
      now: () => NOW,
    });

    expect(stubs['nulab.backlog.jp'].wikiCalls.map((call) => call.projectIdOrKey)).toEqual([1]);
  });

  it('Wiki はプロジェクト数が多くても一度に決まった本数までしか投げない', async () => {
    const projects = Array.from({ length: 12 }, (_, index) =>
      project({ id: index + 1, projectKey: `P${index}` }),
    );
    const stubs = { 'nulab.backlog.jp': stubSpace('nulab.backlog.jp', { projects }) };
    const { onChunk } = collect();

    await runSearch(searchState(), onChunk, {
      deps: depsFor(stubs, { connections: [NULAB] }),
      now: () => NOW,
    });

    const stub = stubs['nulab.backlog.jp'];
    expect(stub.wikiCalls).toHaveLength(12);
    expect(stub.peakWikiConcurrency()).toBeLessThanOrEqual(WIKI_PROJECT_CONCURRENCY);
  });

  it('課題にしかない条件で絞ったときは Wiki とドキュメントを引かない', async () => {
    const stubs = { 'nulab.backlog.jp': stubSpace('nulab.backlog.jp') };
    const { onChunk } = collect();

    await runSearch(searchState({ assignee: { kind: 'me' } }), onChunk, {
      deps: depsFor(stubs, { connections: [NULAB] }),
      now: () => NOW,
    });

    const stub = stubs['nulab.backlog.jp'];
    expect(stub.wikiCalls).toEqual([]);
    expect(stub.documentCalls).toEqual([]);
    expect(stub.issueCalls[0]?.assigneeId).toEqual([MY_USER_ID]);
  });

  it('アーカイブ済みのプロジェクトは既定では引かない', async () => {
    const stubs = {
      'nulab.backlog.jp': stubSpace('nulab.backlog.jp', {
        projects: [project(), project({ id: 2, projectKey: 'OLD', archived: true })],
      }),
    };
    const { onChunk } = collect();

    await runSearch(searchState(), onChunk, {
      deps: depsFor(stubs, { connections: [NULAB] }),
      now: () => NOW,
    });

    expect(stubs['nulab.backlog.jp'].issueCalls[0]?.projectId).toEqual([1]);
  });
});

describe('チャンクの中身', () => {
  it('課題・Wiki・ドキュメントが 1 つのチャンクに入り、更新日時の新しい順に並ぶ', async () => {
    const stubs = {
      'nulab.backlog.jp': stubSpace('nulab.backlog.jp', {
        issues: [
          issue({
            id: 1,
            issueKey: 'PROJ-1',
            summary: '古い設計',
            updated: '2026-09-01T00:00:00Z',
          }),
          issue({
            id: 2,
            issueKey: 'PROJ-2',
            summary: '新しい設計',
            updated: '2026-09-09T00:00:00Z',
          }),
        ],
        wikis: [wiki({ name: '設計メモ', updated: '2026-09-05T00:00:00Z' })],
        documents: [document({ title: '設計の仕様', updated: '2026-09-03T00:00:00Z' })],
      }),
    };
    const { chunks, onChunk } = collect();

    await runSearch(searchState(), onChunk, {
      deps: depsFor(stubs, { connections: [NULAB] }),
      now: () => NOW,
    });

    expect(rowsOf(chunks, 'nulab').map((row) => row.title)).toEqual([
      '新しい設計',
      '設計メモ',
      '設計の仕様',
      '古い設計',
    ]);
    expect(doneOf(chunks, 'nulab')).toMatchObject({ total: 4 });
  });

  it('行は遷移先の URL と所属スペースを持つ', async () => {
    const stubs = {
      'nulab.backlog.jp': stubSpace('nulab.backlog.jp', {
        issues: [issue()],
        wikis: [wiki()],
        documents: [document()],
      }),
    };
    const { chunks, onChunk } = collect();

    await runSearch(searchState(), onChunk, {
      deps: depsFor(stubs, { connections: [NULAB] }),
      now: () => NOW,
    });

    const rows = rowsOf(chunks, 'nulab');

    expect(rows.map((row) => row.url)).toEqual(
      expect.arrayContaining([
        'https://nulab.backlog.jp/view/PROJ-1',
        'https://nulab.backlog.jp/alias/wiki/100',
        'https://nulab.backlog.jp/document/PROJ/doc-1',
      ]),
    );
    expect(rows.every((row) => row.spaceKey === 'nulab')).toBe(true);
  });
});
