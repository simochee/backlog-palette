import { buildCandidates } from '@backlog-palette/core';
import { type PaletteSection, PaletteSurface } from '@backlog-palette/ui';
import { useEffect, useMemo, useState } from 'react';
import { type BootstrapState, type RowAction, sendMessage } from '../../src/messaging/ext.ts';
import type { HostChannel } from '../../src/messaging/hostChannel.ts';
import type { PageContext } from '../../src/messaging/window.ts';
import { apiKeyPageUrl } from '../../src/services/apiKeyPage.ts';
import { CANDIDATE_LABELS } from '../../src/services/candidateLabels.ts';

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
  const [value, setValue] = useState('');
  const [openSeq, setOpenSeq] = useState(0);
  const [toast, setToast] = useState<string | undefined>(undefined);
  const [connectStatus, setConnectStatus] = useState<string | undefined>(undefined);

  const sections = useMemo(() => {
    if (value.trim() === '') {
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

    return buildCandidates({
      input: value,
      index: bootstrap.index,
      frecencyOf: (id) => bootstrap.frecency[id] ?? 0,
      labels: CANDIDATE_LABELS,
      showSpaceBadges: false,
    });
  }, [value, bootstrap, connectStatus, ctx?.spaceKey]);

  const actions = useMemo(() => {
    const map: Record<string, RowAction> = { ...bootstrap.actions };
    const issueKey = value.trim();
    if (/^[A-Z][A-Z0-9_]*-\d+$/.test(issueKey) && ctx !== undefined) {
      map[`openIssue:${issueKey}`] = {
        kind: 'navigate',
        url: `${ctx.origin}/view/${issueKey}`,
      };
    }
    return map;
  }, [bootstrap.actions, value, ctx]);

  useEffect(() => {
    const unsubscribe = channel.subscribe((message) => {
      if (message.t === 'close') {
        setCtx(undefined);
        setValue('');
        return;
      }

      setCtx(message.ctx);
      setValue('');
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
          path={[
            { label: ctx.spaceKey ?? '全スペース', avatar: ctx.spaceKey !== undefined },
            ...(ctx.projectKey === undefined
              ? []
              : [{ label: ctx.projectKey, avatar: true } as const]),
          ]}
          sections={sections}
          value={value}
          footerNote={toast}
          onValueChange={setValue}
          onAction={(id) => {
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
          onEscape={() => channel.send({ t: 'close' })}
          autoFocus
        />
      </div>
    </div>
  );
}
