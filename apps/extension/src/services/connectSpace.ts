import type { ConnectOutcome, ConnectRequest } from '../messaging/ext.ts';
import { connectWithApiKey } from './auth/connect.ts';
import { connectWithOAuth } from './auth/oauth.ts';

/**
 * 接続の失敗理由を、利用者が次の一手を選べる文言に写す（実装プラン §13）。
 *
 * 原因を伏せて「失敗しました」とだけ出すと、キーが違うのか、そのスペースが
 * 存在しないのか、こちらの設定が足りないのかが区別できない。
 */
const MESSAGES: Record<string, string> = {
  notConfigured: 'OAuth の設定がまだ入っていません。API キーで接続してください',
  invalidKey: 'API キーが違うようです。もう一度確認してください',
  unreachable: 'このスペースに接続できませんでした。ホスト名を確認してください',
  alreadyConnected: 'このスペースはすでに接続済みです',
  cancelled: '接続を中止しました',
  denied: '許可されなかったため接続できませんでした',
  stateMismatch: '接続の途中で応答が変わりました。もう一度お試しください',
};

export async function connectSpace(request: ConnectRequest, now: number): Promise<ConnectOutcome> {
  const result =
    request.method === 'oauth'
      ? await connectWithOAuth(request.host, now)
      : await connectWithApiKey(request.host, request.apiKey, now);

  if (result.ok) {
    return {
      ok: true,
      spaceKey: result.connection.spaceKey,
      displayName: result.connection.displayName,
    };
  }

  return {
    ok: false,
    reason: result.reason,
    message: MESSAGES[result.reason] ?? '接続できませんでした',
  };
}
