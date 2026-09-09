import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import {
  accessTokenExpiresAt,
  authHeaders,
  credentialFor,
  forgetCredentials,
  refreshTokenFor,
  saveAccessToken,
  saveApiKey,
} from './credentials.ts';

describe('認証情報の保管', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('アクセストークンはブラウザを閉じたら消える保管先に入る', async () => {
    await saveAccessToken('nulab', { accessToken: 'access-token' });

    expect(await fakeBrowser.storage.session.get('tokens')).toEqual({
      tokens: { nulab: { accessToken: 'access-token' } },
    });
  });

  it('アクセストークンは残る保管先には書かない', async () => {
    await saveAccessToken('nulab', { accessToken: 'access-token' });

    expect(JSON.stringify(await fakeBrowser.storage.local.get(null))).not.toContain('access-token');
  });

  it('リフレッシュトークンは削除できる保管先に入る', async () => {
    await saveAccessToken('nulab', { accessToken: 'access-token' }, 'refresh-token');

    expect(await fakeBrowser.storage.local.get('refreshTokens')).toEqual({
      refreshTokens: { nulab: { refreshToken: 'refresh-token' } },
    });
    expect(await refreshTokenFor('nulab')).toBe('refresh-token');
  });

  it('API キーは削除できる保管先に入る', async () => {
    await saveApiKey('nulab', 'api-key');

    expect(await fakeBrowser.storage.local.get('refreshTokens')).toEqual({
      refreshTokens: { nulab: { apiKey: 'api-key' } },
    });
  });

  it('API キーはセッションの保管先には置かない', async () => {
    await saveApiKey('nulab', 'api-key');

    expect(JSON.stringify(await fakeBrowser.storage.session.get(null))).not.toContain('api-key');
  });

  it('API キーで接続したスペースにはキーのヘッダが付く', async () => {
    await saveApiKey('nulab', 'api-key');

    expect(await credentialFor('nulab')).toEqual({ method: 'apiKey', apiKey: 'api-key' });
    expect(authHeaders({ method: 'apiKey', apiKey: 'api-key' })).toEqual({
      'Backlog-API-Key': 'api-key',
    });
  });

  it('OAuth で接続したスペースにはアクセストークンのヘッダが付く', async () => {
    await saveAccessToken('nulab', { accessToken: 'access-token' });

    expect(await credentialFor('nulab')).toEqual({ method: 'oauth', accessToken: 'access-token' });
    expect(authHeaders({ method: 'oauth', accessToken: 'access-token' })).toEqual({
      Authorization: 'Bearer access-token',
    });
  });

  it('アクセストークンの期限は保管した値をそのまま返す', async () => {
    await saveAccessToken('nulab', { accessToken: 'access-token', expiresAt: 1_800_000 });

    expect(await accessTokenExpiresAt('nulab')).toBe(1_800_000);
    expect(await accessTokenExpiresAt('acme')).toBeUndefined();
  });

  it('認証情報の無いスペースには何も返さない', async () => {
    expect(await credentialFor('acme')).toBeUndefined();
  });

  it('忘れさせると両方の保管先から実際に消える', async () => {
    await saveAccessToken('nulab', { accessToken: 'access-token' }, 'refresh-token');
    await saveApiKey('nulab', 'api-key');

    await forgetCredentials('nulab');

    expect(await credentialFor('nulab')).toBeUndefined();
    expect(await refreshTokenFor('nulab')).toBeUndefined();
    expect(JSON.stringify(await fakeBrowser.storage.local.get(null))).not.toContain(
      'refresh-token',
    );
    expect(JSON.stringify(await fakeBrowser.storage.session.get(null))).not.toContain(
      'access-token',
    );
  });

  it('あるスペースを忘れても別のスペースの認証情報は残る', async () => {
    await saveApiKey('nulab', 'nulab-key');
    await saveApiKey('acme', 'acme-key');

    await forgetCredentials('nulab');

    expect(await credentialFor('acme')).toEqual({ method: 'apiKey', apiKey: 'acme-key' });
  });
});
