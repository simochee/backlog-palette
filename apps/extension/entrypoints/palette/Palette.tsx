import { type PaletteSection, PaletteSurface } from '@backlog-palette/ui';
import { useEffect, useState } from 'react';
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
 * 空状態は API 応答を待たずに描く（§14）。ここが待つのは
 * Service Worker が表示キャッシュを読む往復だけで、ネットワークには出ない。
 */
export function Palette({ channel }: PaletteProps) {
  const [ctx, setCtx] = useState<PageContext | undefined>(undefined);
  const [sections, setSections] = useState<readonly PaletteSection[]>([]);

  useEffect(() => {
    const unsubscribe = channel.subscribe((message) => {
      if (message.t === 'close') {
        setCtx(undefined);
        return;
      }

      setCtx(message.ctx);

      sendMessage('getBootstrap', 'modal')
        .then((state) => {
          setSections(state.sections.length > 0 ? state.sections : NOT_CONNECTED);
        })
        .catch(() => {
          setSections(NOT_CONNECTED);
        });

      // フォーカスは開いた側ではなく自分で取る。以降のキー入力は iframe に閉じ、
      // Backlog の単キーショートカット（j/k 等）が誤爆しない（§9.4）
      requestAnimationFrame(() => {
        document.querySelector('input')?.focus();
      });
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.isComposing) channel.send({ t: 'close' });
    };
    window.addEventListener('keydown', onKeyDown);

    if (import.meta.env.DEV) console.debug('[bp] palette iframe: 受信を開始した');

    return () => {
      unsubscribe();
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [channel]);

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
        />
      </div>
    </div>
  );
}
