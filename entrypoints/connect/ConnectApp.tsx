import { startTransition, useActionState, useEffect } from 'react';

import { type Labels, useLabels } from '@/components/labels';
import { ConnectSheet } from '@/components/organisms/ConnectSheet';
import type { ConnectSheetState } from '@/components/types';
import { connectSpace } from '@/lib/connect/connectSpace';

import { connectDeps } from './deps.ts';
import { hostChannel } from './hostChannel.ts';
import { resolveSpaceHostFromTab } from './space.ts';

const close = () => hostChannel.send({ t: 'close' });

function useEscapeCloses() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.isComposing) return;
      event.preventDefault();
      close();
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true });
    };
  }, []);
}

/** 送信 1 回の結果を次の状態として返す。送信中は useActionState の pending が表す */
async function connect(apiKey: string, labels: Labels): Promise<ConnectSheetState> {
  // タブが読めないのも「繋げなかった」。Action から投げると、境界の無い root ごと消える
  const spaceHost = await resolveSpaceHostFromTab().catch(() => null);
  if (typeof spaceHost !== 'string') return { kind: 'error', message: labels.connect.failed };
  const result = await connectSpace(spaceHost, apiKey, connectDeps);
  if (result.ok) {
    hostChannel.send({ t: 'connected' });
    return { kind: 'done', spaceLabel: result.space.name };
  }
  const message =
    result.failure.kind === 'unauthorized' ? labels.connect.invalidKey : labels.connect.failed;
  return { kind: 'error', message };
}

/** 貼り付けバーの container。鍵は入力欄から connectSpace へ渡すだけで、状態にも持たない（I7） */
export function ConnectApp() {
  const labels = useLabels();
  const [state, submit, submitting] = useActionState(
    (_previous: ConnectSheetState, apiKey: string) => connect(apiKey, labels),
    { kind: 'idle' },
  );
  useEscapeCloses();

  return (
    <div className="flex h-dvh items-end justify-center px-2 pb-2">
      <ConnectSheet
        state={submitting ? { kind: 'submitting' } : state}
        onSubmit={(apiKey) => startTransition(() => submit(apiKey))}
        onClose={close}
      />
    </div>
  );
}
