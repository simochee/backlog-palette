import { describe, expect, it, vi } from 'vitest';

import { createLatestSupply } from './latestSupply';

/** 頼まれた順に作り直しを溜め、テストが好きな順で終わらせる */
function manualMaker() {
  const calls: PromiseWithResolvers<string>[] = [];
  const make = () => {
    const call = Promise.withResolvers<string>();
    calls.push(call);
    return call.promise;
  };
  const finish = async (index: number, value: string) => {
    calls[index]?.resolve(value);
    await new Promise((done) => {
      setTimeout(done, 0);
    });
  };
  return { make, finish };
}

/** 最初の作り直しを頼んだばかりで、まだ一度も作り終えていない */
function unsettledSupply() {
  const maker = manualMaker();
  const supply = createLatestSupply(maker.make, 'initial');
  void supply.refresh();
  return { maker, supply };
}

describe('作り直しの反映', () => {
  it('作り直しが重なったら、古い方が後に終わっても最後に頼んだ値のまま', async () => {
    const { maker, supply } = unsettledSupply();
    void supply.refresh();

    await maker.finish(1, 'new');
    await maker.finish(0, 'old');

    expect(supply.current.get()).toBe('new');
  });

  it('古い方が先に終わっても反映せず、最後に頼んだ値を待つ', async () => {
    const { maker, supply } = unsettledSupply();
    void supply.refresh();

    await maker.finish(0, 'old');

    expect(supply.current.get()).toBe('initial');
  });
});

describe('一度も作り終えていないときの受け手', () => {
  it('一度も作り終えていなければ、作り終えた時点で受け手に渡す', async () => {
    const { maker, supply } = unsettledSupply();
    const receive = vi.fn<(value: string) => void>();

    supply.deliver(receive);
    expect(receive).not.toHaveBeenCalled();

    await maker.finish(0, 'ready');
    expect(receive).toHaveBeenCalledExactlyOnceWith('ready');
  });

  it('待っている間に作り直しが重なったら、古い方ではなく最後に頼んだ値を渡す', async () => {
    const { maker, supply } = unsettledSupply();
    const receive = vi.fn<(value: string) => void>();
    supply.deliver(receive);
    void supply.refresh();

    await maker.finish(0, 'old');
    expect(receive).not.toHaveBeenCalled();

    await maker.finish(1, 'new');
    expect(receive).toHaveBeenCalledExactlyOnceWith('new');
  });

  it('取り消した受け手には、後で作り終えても渡さない', async () => {
    const { maker, supply } = unsettledSupply();
    const receive = vi.fn<(value: string) => void>();
    supply.deliver(receive);

    supply.cancel();
    await maker.finish(0, 'ready');

    expect(receive).not.toHaveBeenCalled();
  });

  it('後から頼んだ受け手が前の受け手を置き換え、前の受け手には渡さない', async () => {
    const { maker, supply } = unsettledSupply();
    const first = vi.fn<(value: string) => void>();
    const second = vi.fn<(value: string) => void>();
    supply.deliver(first);
    supply.deliver(second);

    await maker.finish(0, 'ready');

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledExactlyOnceWith('ready');
  });
});

describe('一度でも作り終えた後の受け手', () => {
  it('一度でも作り終えていれば、作り直しの途中でも直前の値をその場で渡す', async () => {
    const { maker, supply } = unsettledSupply();
    await maker.finish(0, 'ready');
    void supply.refresh();
    const receive = vi.fn<(value: string) => void>();

    supply.deliver(receive);

    expect(receive).toHaveBeenCalledExactlyOnceWith('ready');
  });

  it('渡した受け手には、その後の作り直しの値を渡さない', async () => {
    const { maker, supply } = unsettledSupply();
    const receive = vi.fn<(value: string) => void>();
    supply.deliver(receive);
    await maker.finish(0, 'first');
    void supply.refresh();

    await maker.finish(1, 'second');

    expect(receive).toHaveBeenCalledExactlyOnceWith('first');
  });
});
