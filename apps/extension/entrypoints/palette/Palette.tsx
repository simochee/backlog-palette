import {
  activeCommand,
  defaultSearchState,
  type SearchState,
  scopeOf,
} from '@backlog-palette/core';
import { type PaletteSection, PaletteSurface } from '@backlog-palette/ui';
import { useEffect, useMemo, useState } from 'react';
import { useSearch } from '../../src/hooks/useSearch.ts';
import { type BootstrapState, type RowAction, sendMessage } from '../../src/messaging/ext.ts';
import type { HostChannel } from '../../src/messaging/hostChannel.ts';
import type { PageContext } from '../../src/messaging/window.ts';
import { apiKeyPageUrl } from '../../src/services/apiKeyPage.ts';
import { CANDIDATE_LABELS } from '../../src/services/candidateLabels.ts';
import {
  SWITCH_SPACE,
  spaceOrigins,
  switchSpaceStage,
  twoStageCommandEntries,
  twoStageCommandOf,
  withTwoStageHints,
} from '../../src/services/paletteCommands.ts';
import {
  candidatesFor,
  escapeLabel,
  footerHints,
  initialState,
  type PaletteState,
  pathOf,
  reduce,
} from '../../src/services/paletteStack.ts';

export type PaletteProps = {
  channel: HostChannel;
};

/** 接続済みだが出せるものがまだ無いとき。行き止まりにしない */
function emptyHint(): readonly PaletteSection[] {
  return [
    {
      id: 'hint',
      rows: [
        {
          id: 'hint-type',
          kind: 'page',
          title: 'ページ名や課題キーを入力してください',
          sub: '見たページはここに並ぶようになります',
        },
      ],
    },
  ];
}

/**
 * 未接続のときは 1 行だけ出す（実装プラン §5.4 の C1）。
 * 説明を読ませずに接続まで運ぶのが目的なので、選択肢を増やさない。
 */
function onboardingSections(status: string | undefined): PaletteSection[] {
  return [
    {
      id: 'onboarding',
      rows: [
        {
          id: 'connect',
          kind: 'connect',
          title: status ?? 'このスペースを接続',
          sub: 'API キーの発行ページを開きます',
          tone: 'accent',
          hint: 'enter',
        },
      ],
    },
  ];
}

const EMPTY: BootstrapState = {
  sections: [],
  index: [],
  frecency: {},
  actions: {},
  connectedSpaces: [],
  learningEnabled: true,
};

/**
 * 候補は開いたときに受け取った索引から同期的に組む（§7.2）。
 *
 * 打鍵ごとに Service Worker と往復しない。往復すると応答より先に Enter を
 * 押せてしまい、1 打鍵前の候補で遷移する事故が起きる。
 */
export function Palette({ channel }: PaletteProps) {
  const [ctx, setCtx] = useState<PageContext | undefined>(undefined);
  const [bootstrap, setBootstrap] = useState<BootstrapState>(EMPTY);
  const [state, setState] = useState<PaletteState>(() => initialState({}));
  const [openSeq, setOpenSeq] = useState(0);
  const [toast, setToast] = useState<string | undefined>(undefined);
  const search = useSearch(ctx?.spaceKey);
  const [connectStatus, setConnectStatus] = useState<string | undefined>(undefined);

  /*
   * コマンドを積んでいる間は索引を見ない。出すのはそのコマンドの引数だけで、
   * 同じ入力でページ候補も混ぜると「今どの階層にいるか」が画面から消える（A7）。
   */
  const stage = useMemo(() => {
    if (activeCommand(state.stack)?.commandId !== SWITCH_SPACE || ctx === undefined) {
      return undefined;
    }

    const origins = spaceOrigins(bootstrap.actions, ctx);
    return switchSpaceStage({
      spaces: bootstrap.connectedSpaces,
      originOf: (spaceKey) => origins.get(spaceKey),
      query: state.query,
    });
  }, [state.stack, state.query, bootstrap.actions, bootstrap.connectedSpaces, ctx]);

  const sections = useMemo(() => {
    if (stage !== undefined) return stage.sections;

    if (state.query.trim() === '') {
      /*
       * 接続を促すのは「まだ接続していないとき」だけ。空状態が空かどうかで
       * 判断すると、接続済みでも履歴が無いだけで接続行が出てしまう。
       */
      const connected = bootstrap.connectedSpaces.some((space) => space.spaceKey === ctx?.spaceKey);
      if (connected) {
        return bootstrap.sections.length > 0 ? bootstrap.sections : emptyHint();
      }

      /*
       * 未接続でも、表示キャッシュから出せるものがあるなら出す（§9）。接続は
       * 末尾の 1 行で促す（モック A6）。何も出せないときだけ、説明を読ませずに
       * 接続へ運ぶ C1 の形にする。
       */
      if (bootstrap.sections.length === 0) return onboardingSections(connectStatus);

      return [...bootstrap.sections, ...onboardingSections(connectStatus)];
    }

    const local = withTwoStageHints(
      candidatesFor({
        state,
        base: { spaceKey: ctx?.spaceKey, projectKey: ctx?.projectKey },
        index: bootstrap.index,
        commands: twoStageCommandEntries(bootstrap.connectedSpaces),
        frecencyOf: (id) => bootstrap.frecency[id] ?? 0,
        labels: CANDIDATE_LABELS,
      }),
    );

    /*
     * 検索結果はパレットの中に出す。実機で触って、打った語の結果がその場に
     * 出ないのが不自然だと分かった。サイドパネルは「詳しく見る」側に回る。
     */
    if (search.results.rows.length === 0 && !search.running) return local;

    return [
      ...local,
      {
        id: 'search-results',
        label: '検索結果',
        meta: search.running ? '検索中…' : `${search.results.rows.length} 件`,
        rows: search.results.rows.map((row) => ({ ...row })),
      },
    ];
  }, [
    stage,
    state,
    bootstrap,
    connectStatus,
    ctx?.spaceKey,
    ctx?.projectKey,
    search.results,
    search.running,
  ]);

  const actions = useMemo(() => {
    const map: Record<string, RowAction> = { ...bootstrap.actions, ...stage?.actions };
    for (const row of search.results.rows) {
      map[row.id] = { kind: 'navigate', url: row.url };
    }
    const issueKey = state.query.trim();
    if (/^[A-Z][A-Z0-9_]*-\d+$/.test(issueKey) && ctx !== undefined) {
      map[`openIssue:${issueKey}`] = {
        kind: 'navigate',
        url: `${ctx.origin}/view/${issueKey}`,
      };
    }
    return map;
  }, [bootstrap.actions, stage, state.query, ctx, search.results.rows]);

  useEffect(() => {
    const unsubscribe = channel.subscribe((message) => {
      if (message.t === 'close') {
        setCtx(undefined);
        setState(initialState({}));
        return;
      }

      setCtx(message.ctx);
      setState(initialState(message.ctx));
      setToast(undefined);
      setConnectStatus(undefined);
      setOpenSeq((seq) => seq + 1);

      sendMessage('getBootstrap', { surface: 'modal', ctx: message.ctx })
        .then(setBootstrap)
        .catch(() => setBootstrap(EMPTY));

      /*
       * 担当課題は別の鎖にする。同じ鎖に繋ぐと、こちらの失敗が
       * 成功した空状態まで巻き戻してしまう（実際に踏んだ）。
       * API が要るので初回描画には含めず、届いた時点で追記する（§14）。
       */
      const spaceKey = message.ctx.spaceKey;
      if (spaceKey !== undefined) {
        sendMessage('getAssignedIssues', spaceKey)
          .then((section) => {
            if (section === undefined) return;
            setBootstrap((current) => ({
              ...current,
              sections: [...current.sections, section],
            }));
          })
          .catch(() => undefined);
      }
    });

    /*
     * 背景の暗転部分にフォーカスがあるときの保険。入力欄にフォーカスが
     * あるときは PaletteSurface の onEscape が先に処理する。
     */
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.isComposing) channel.send({ t: 'close' });
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      unsubscribe();
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [channel]);

  useEffect(() => {
    if (openSeq === 0) return;
    document.querySelector('input')?.focus();
  }, [openSeq]);

  if (ctx === undefined) return null;

  return (
    <div
      className="backdrop"
      data-bp-theme=""
      data-bp-scheme={window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) channel.send({ t: 'close' });
      }}
    >
      <div className="slot">
        <PaletteSurface
          path={pathOf(state.stack)}
          sections={sections}
          value={state.query}
          footer={footerHints(state)}
          footerNote={toast}
          armedNotice={state.stack.armedForDelete}
          escLabel={escapeLabel(state)}
          onValueChange={(next) =>
            setState((current) => reduce(current, { type: 'query', value: next }).state)
          }
          onComplete={(id) => {
            /*
             * Tab は「その候補に決める」。プロジェクトやスペースならスコープと
             * して積み、それ以外は入力を候補の文言で補完する（§3 D1）。
             * 積むほうを優先するのは、絞り込んでから探すのが普通の順序だから。
             */
            const entry = bootstrap.index.find((candidate) => candidate.id === id);
            const projectKey = entry?.kind === 'project' ? entry.code : undefined;
            if (entry !== undefined && projectKey !== undefined) {
              setState(
                (current) =>
                  reduce(current, {
                    type: 'scope',
                    segment: { kind: 'project', projectId: projectKey, label: entry.text },
                  }).state,
              );
              return;
            }
            if (entry?.kind === 'space') {
              setState(
                (current) =>
                  reduce(current, {
                    type: 'scope',
                    segment: { kind: 'space', spaceId: entry.text, label: entry.text },
                  }).state,
              );
              return;
            }
            if (entry !== undefined) {
              setState((current) => reduce(current, { type: 'query', value: entry.text }).state);
            }
          }}
          onStackBackspace={(caret) =>
            setState((current) => reduce(current, { type: 'backspace', caret }).state)
          }
          onAction={(id) => {
            if (id === 'searchInPanel') {
              /*
               * 検索はパレットの中で走らせる。行の実行が何も起こさない状態だと、
               * 一番普通の操作（語を打って Enter）が死ぬ。
               */
              const scope = scopeOf(state.stack);
              search.start({
                ...defaultSearchState,
                query: state.query.trim(),
                scope:
                  scope.kind === 'project'
                    ? { kind: 'project', spaceKey: scope.spaceId, projectKey: scope.projectId }
                    : scope.kind === 'space'
                      ? { kind: 'space', spaceKey: scope.spaceId }
                      : { kind: 'allSpaces' },
              } satisfies SearchState);
              return;
            }

            if (id === 'connect') {
              /*
               * 発行ページまで連れて行くだけ。そこで content script が
               * メモ欄を埋め、貼り付け先を出す（§10.2）。キーの読み取りは
               * 拡張がやらない。
               */
              void sendMessage('runRowAction', {
                kind: 'navigate',
                url: apiKeyPageUrl(ctx.origin),
                target: 'currentTab',
              }).catch(() => undefined);
              channel.send({ t: 'close' });
              return;
            }

            /*
             * 2 段階のコマンドは遷移させない。ここで閉じると、コマンドの
             * 引数を選ぶ階層そのものが出せなくなる（§3 D3・モック A7）。
             */
            const command = twoStageCommandOf(id);
            if (command !== undefined) {
              setState((current) => reduce(current, { type: 'command', ...command }).state);
              return;
            }

            const action = actions[id];
            if (action === undefined) return;

            /*
             * コピーだけは Service Worker では実行できない（DOM を持たず
             * navigator.clipboard が無い）。ここで書き込み、何をコピーしたかを
             * 見せてから閉じる。押した結果が見えないコピーは信用されない。
             */
            if (action.kind === 'copy') {
              navigator.clipboard.writeText(action.text).catch(() => {});
              setToast(action.toast);
              window.setTimeout(() => channel.send({ t: 'close' }), 1_200);
              return;
            }

            sendMessage('runRowAction', { ...action, entryId: id }).catch(() => {});
            channel.send({ t: 'close' });
          }}
          onEscape={() => {
            const step = reduce(state, { type: 'escape' });
            if (step.close) channel.send({ t: 'close' });
            else setState(step.state);
          }}
          autoFocus
        />
      </div>
    </div>
  );
}
