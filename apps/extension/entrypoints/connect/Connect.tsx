import { Button } from '@backlog-palette/ui';
import { useEffect, useRef, useState } from 'react';
import { sendMessage } from '../../src/messaging/ext.ts';
import { isTrustedPageOrigin } from '../../src/messaging/window.ts';

type Phase =
  | { kind: 'input' }
  | { kind: 'working' }
  | { kind: 'error'; message: string }
  | { kind: 'done'; displayName: string };

/**
 * API キーの貼り付け先（実装プラン §10.2）。
 *
 * 拡張ページとして iframe で出す。ページ側に入力欄を作ると、貼り付けた
 * キーが Backlog のページのコンテキストを通る（§2.3）。キーは発行ページに
 * 表示されているが、それを読み取るのは拡張ではなく人がやる。
 */
export function Connect() {
  const [host, setHost] = useState<string | undefined>(undefined);
  const [apiKey, setApiKey] = useState('');
  const [phase, setPhase] = useState<Phase>({ kind: 'input' });
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    /*
     * どのスペースに繋ぐかは Service Worker がタブ URL から決める（§2.3・§9.3）。
     * iframe の src にホストを載せると、ページ側が差し替えられる余地が残る。
     */
    sendMessage('getActiveContext')
      .then((active) => {
        if (active === undefined) return;
        const parsed = new URL(active.origin);
        if (isTrustedPageOrigin(parsed.origin)) setHost(parsed.host);
      })
      .catch(() => undefined);

    inputRef.current?.focus();
  }, []);

  const submit = () => {
    if (host === undefined || apiKey.trim() === '') return;

    setPhase({ kind: 'working' });
    sendMessage('connectSpace', { method: 'apiKey', host, apiKey: apiKey.trim() })
      .then((outcome) => {
        if (outcome.ok) {
          setApiKey('');
          setPhase({ kind: 'done', displayName: outcome.displayName });
          return;
        }
        setPhase({ kind: 'error', message: outcome.message });
      })
      .catch(() => setPhase({ kind: 'error', message: '接続できませんでした' }));
  };

  return (
    <div
      className="sheet"
      data-bp-theme=""
      data-bp-scheme={window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'}
    >
      <h1 className="title">
        {phase.kind === 'done' ? `${phase.displayName} に接続しました` : 'Backlog Palette に接続'}
      </h1>

      {phase.kind === 'done' ? (
        <p className="message">
          このページは閉じて構いません。⌘K でパレットを開くと、このスペースの課題と Wiki
          を検索できます。
        </p>
      ) : (
        <>
          <ol className="steps">
            <li>下のフォームで API キーを発行します（メモは入力済みです）</li>
            <li>表示されたキーをコピーして、ここに貼り付けます</li>
          </ol>

          <div className="field">
            <input
              ref={inputRef}
              className="input"
              type="password"
              value={apiKey}
              placeholder="API キーを貼り付け"
              aria-label="API キー"
              onChange={(event) => setApiKey(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.nativeEvent.isComposing) submit();
              }}
            />
            <Button onPress={submit} isDisabled={apiKey.trim() === '' || phase.kind === 'working'}>
              接続
            </Button>
          </div>

          {phase.kind === 'error' ? (
            <p className="message" data-tone="error">
              {phase.message}
            </p>
          ) : (
            <p className="message">
              キーは端末内にのみ保存され、外部へは送信されません。設定からいつでも削除できます。
            </p>
          )}
        </>
      )}
    </div>
  );
}
