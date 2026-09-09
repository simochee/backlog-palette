import { describe, expect, it, vi } from 'vitest';
import { createHostChannel } from './hostChannel.ts';
import type { ToIframe } from './window.ts';

const TRUSTED = 'https://nulab.backlog.jp';

function fakeScope() {
  let listener: ((event: MessageEvent<unknown>) => void) | undefined;
  const postMessage = vi.fn();

  return {
    scope: {
      addEventListener: (_type: 'message', next: (event: MessageEvent<unknown>) => void) => {
        listener = next;
      },
      parent: { postMessage },
    },
    postMessage,
    emit(origin: string, data: unknown) {
      listener?.({ origin, data } as MessageEvent<unknown>);
    },
  };
}

const openMessage: ToIframe = { t: 'open', ctx: { origin: TRUSTED } };

describe('マウント前に届いたメッセージ', () => {
  it('subscribe した時点でまとめて渡される', () => {
    const { scope, emit } = fakeScope();
    const channel = createHostChannel(scope);

    emit(TRUSTED, openMessage);

    const handler = vi.fn();
    channel.subscribe(handler);

    expect(handler).toHaveBeenCalledWith(openMessage);
  });

  it('一度渡したメッセージは二度渡さない', () => {
    const { scope, emit } = fakeScope();
    const channel = createHostChannel(scope);
    emit(TRUSTED, openMessage);

    const first = vi.fn();
    channel.subscribe(first)();
    const second = vi.fn();
    channel.subscribe(second);

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
  });
});

describe('返信先のオリジン', () => {
  it('実際に送ってきたオリジンにだけ返す', () => {
    const { scope, emit, postMessage } = fakeScope();
    const channel = createHostChannel(scope);

    emit(TRUSTED, openMessage);
    channel.send({ t: 'close' });

    expect(postMessage).toHaveBeenCalledWith({ t: 'close' }, TRUSTED);
  });

  it('一度も受信していなければ送らない', () => {
    const { scope, postMessage } = fakeScope();
    createHostChannel(scope).send({ t: 'close' });

    expect(postMessage).not.toHaveBeenCalled();
  });

  it('信頼できないオリジンからのメッセージは返信先にならない', () => {
    const { scope, emit, postMessage } = fakeScope();
    const channel = createHostChannel(scope);

    emit('https://evil.example.com', openMessage);
    channel.send({ t: 'close' });

    expect(postMessage).not.toHaveBeenCalled();
  });

  it('規定外のメッセージは無視する', () => {
    const { scope, emit } = fakeScope();
    const channel = createHostChannel(scope);
    const handler = vi.fn();
    channel.subscribe(handler);

    emit(TRUSTED, { t: 'navigate', url: 'https://evil.example.com' });

    expect(handler).not.toHaveBeenCalled();
  });
});
