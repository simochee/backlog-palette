import { buildCandidates } from '@backlog-palette/core';
import { type PaletteSection, PaletteSurface } from '@backlog-palette/ui';
import { useEffect, useMemo, useState } from 'react';
import { type BootstrapState, type RowAction, sendMessage } from '../../src/messaging/ext.ts';
import type { HostChannel } from '../../src/messaging/hostChannel.ts';
import type { PageContext } from '../../src/messaging/window.ts';
import { CANDIDATE_LABELS } from '../../src/services/candidateLabels.ts';

export type PaletteProps = {
  channel: HostChannel;
};

const NOT_CONNECTED: readonly PaletteSection[] = [
  {
    id: 'onboarding',
    rows: [
      {
        id: 'connect',
        kind: 'connect',
        title: 'このスペースを接続',
        sub: '接続すると最近見た課題と検索が使えます',
        tone: 'accent',
        hint: 'enter',
      },
    ],
  },
];

const EMPTY: BootstrapState = {
  sections: [],
  index: [],
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

  const sections = useMemo(() => {
    if (value.trim() === '') {
      return bootstrap.sections.length > 0 ? bootstrap.sections : NOT_CONNECTED;
    }

    return buildCandidates({
      input: value,
      index: bootstrap.index,
      // 行動ログは M5。学習をオフにしているときもここは 0 で据え置く
      frecencyOf: () => 0,
      labels: CANDIDATE_LABELS,
      showSpaceBadges: false,
    });
  }, [value, bootstrap]);

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
      setOpenSeq((seq) => seq + 1);

      sendMessage('getBootstrap', { surface: 'modal', ctx: message.ctx })
        .then(setBootstrap)
        .catch(() => setBootstrap(EMPTY));
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

            sendMessage('runRowAction', action).catch(() => {});
            channel.send({ t: 'close' });
          }}
          onEscape={() => channel.send({ t: 'close' })}
          autoFocus
        />
      </div>
    </div>
  );
}
