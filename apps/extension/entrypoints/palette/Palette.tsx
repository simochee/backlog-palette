import { PaletteSurface } from '@backlog-palette/ui';
import { useEffect, useRef, useState } from 'react';
import type { HostChannel } from '../../src/messaging/hostChannel.ts';
import type { PageContext } from '../../src/messaging/window.ts';
import { emptyStateSections } from './placeholderData.ts';

export type PaletteProps = {
  channel: HostChannel;
};

/**
 * M0 スパイクの検証対象（実装プラン §18-7）:
 * クロスオリジン iframe が open を受けて自分で input にフォーカスを移せるか。
 */
export function Palette({ channel }: PaletteProps) {
  const [ctx, setCtx] = useState<PageContext | undefined>(undefined);
  const surfaceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = channel.subscribe((message) => {
      if (message.t === 'close') {
        setCtx(undefined);
        return;
      }

      setCtx(message.ctx);

      // フォーカスは開いた側ではなく自分で取る。以降のキー入力は iframe に閉じ、
      // Backlog の単キーショートカット（j/k 等）が誤爆しない（§9.4）
      requestAnimationFrame(() => {
        surfaceRef.current?.querySelector('input')?.focus();
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
      <div className="slot" ref={surfaceRef}>
        <PaletteSurface
          path={[
            { label: ctx.spaceKey ?? '全スペース', avatar: ctx.spaceKey !== undefined },
            ...(ctx.projectKey === undefined
              ? []
              : [{ label: ctx.projectKey, avatar: true } as const]),
          ]}
          sections={emptyStateSections}
        />
      </div>
    </div>
  );
}
