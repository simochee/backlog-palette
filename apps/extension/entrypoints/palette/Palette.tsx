import { PaletteSurface } from '@backlog-palette/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type FromIframe,
  isToIframe,
  isTrustedPageOrigin,
  type PageContext,
} from '../../src/messaging/window.ts';
import { emptyStateSections } from './placeholderData.ts';

/**
 * M0 スパイクの検証対象（実装プラン §18-7）:
 * クロスオリジン iframe が open を受けて自分で input にフォーカスを移せるか。
 */
export function Palette() {
  const [ctx, setCtx] = useState<PageContext | undefined>(undefined);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const pageOrigin = useRef<string | undefined>(undefined);

  /** targetOrigin に '*' を使わない。開いてきたページのオリジンにだけ返す（§2.3） */
  const send = useCallback((message: FromIframe) => {
    const target = pageOrigin.current;
    if (target === undefined) return;
    window.parent.postMessage(message, target);
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent<unknown>) => {
      if (!isTrustedPageOrigin(event.origin)) return;
      if (!isToIframe(event.data)) return;

      if (event.data.t === 'close') {
        setCtx(undefined);
        return;
      }

      pageOrigin.current = event.origin;
      setCtx(event.data.ctx);

      // フォーカスは開いた側ではなく自分で取る。以降のキー入力は iframe に閉じ、
      // Backlog の単キーショートカット（j/k 等）が誤爆しない（§9.4）
      requestAnimationFrame(() => {
        surfaceRef.current?.querySelector('input')?.focus();
      });
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.isComposing) send({ t: 'close' });
    };

    window.addEventListener('message', onMessage);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('message', onMessage);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [send]);

  if (ctx === undefined) return null;

  return (
    <div
      className="backdrop"
      data-bp-theme=""
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) send({ t: 'close' });
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
