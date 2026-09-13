import { useEffect, useState } from 'react';

import { useLabels } from '@/components/labels';
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

/** 貼り付けバーの container。鍵は入力欄から connectSpace へ渡すだけで、状態にも持たない（I7） */
export function ConnectApp() {
  const labels = useLabels();
  const [state, setState] = useState<ConnectSheetState>({ kind: 'idle' });
  useEscapeCloses();

  const submit = async (apiKey: string) => {
    setState({ kind: 'submitting' });
    const spaceHost = await resolveSpaceHostFromTab();
    if (spaceHost === undefined) {
      setState({ kind: 'error', message: labels.connect.failed });
      return;
    }
    const result = await connectSpace(spaceHost, apiKey, connectDeps);
    if (result.ok) {
      setState({ kind: 'done', spaceLabel: result.space.name });
      return;
    }
    const message =
      result.failure.kind === 'unauthorized' ? labels.connect.invalidKey : labels.connect.failed;
    setState({ kind: 'error', message });
  };

  return (
    <div className="flex h-dvh items-end justify-center px-2 pb-2">
      <ConnectSheet
        state={state}
        onSubmit={(apiKey) => {
          void submit(apiKey);
        }}
        onClose={close}
      />
    </div>
  );
}
