import { type PaletteSection, PaletteSurface } from '@backlog-palette/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { sendMessage } from '../../src/messaging/ext.ts';
import type { HostChannel } from '../../src/messaging/hostChannel.ts';
import type { PageContext } from '../../src/messaging/window.ts';

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

/**
 * 空状態も打鍵中の候補も API 応答を待たない（§14）。待つのは Service Worker が
 * ローカル索引を引く往復だけで、ネットワークには出ない。
 */
export function Palette({ channel }: PaletteProps) {
  const [ctx, setCtx] = useState<PageContext | undefined>(undefined);
  const [sections, setSections] = useState<readonly PaletteSection[]>([]);
  const [value, setValue] = useState('');
  const urls = useRef<Record<string, string>>({});
  /** 応答が入れ替わっても、最後に打った内容の結果だけを描く */
  const latest = useRef(0);

  const showEmptyState = useCallback(() => {
    const seq = ++latest.current;
    sendMessage('getBootstrap', 'modal')
      .then((state) => {
        if (seq !== latest.current) return;
        urls.current = {};
        setSections(state.sections.length > 0 ? state.sections : NOT_CONNECTED);
      })
      .catch(() => {
        if (seq === latest.current) setSections(NOT_CONNECTED);
      });
  }, []);

  const search = useCallback(
    (input: string, pageContext: PageContext) => {
      if (input.trim() === '') {
        showEmptyState();
        return;
      }

      const seq = ++latest.current;
      sendMessage('localCandidates', { input, ctx: pageContext })
        .then((result) => {
          if (seq !== latest.current) return;
          urls.current = result.urls;
          setSections(result.sections);
        })
        .catch(() => {
          if (seq === latest.current) setSections([]);
        });
    },
    [showEmptyState],
  );

  useEffect(() => {
    const unsubscribe = channel.subscribe((message) => {
      if (message.t === 'close') {
        setCtx(undefined);
        setValue('');
        return;
      }

      setCtx(message.ctx);
      setValue('');
      showEmptyState();
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
  }, [channel, showEmptyState]);

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
          onValueChange={(next) => {
            setValue(next);
            search(next, ctx);
          }}
          onAction={(id) => {
            const url = urls.current[id];
            if (url === undefined) return;

            // 遷移は Service Worker が行う。ページ側の location には触らない（§2.3）
            sendMessage('navigate', { url, target: 'currentTab' }).catch(() => {});
            channel.send({ t: 'close' });
          }}
          onEscape={() => channel.send({ t: 'close' })}
          autoFocus
        />
      </div>
    </div>
  );
}
