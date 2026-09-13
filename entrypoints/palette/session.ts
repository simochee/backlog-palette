import { useCallback, useEffect, useRef, useState } from 'react';

import type { Labels } from '@/components/labels';
import type { HostChannel } from '@/lib/messaging/hostChannel';
import type { PageContext } from '@/lib/messaging/window';
import { createPaletteStore, type PaletteIndex, type PaletteStore } from '@/lib/palette';
import { settings } from '@/lib/storage/palette-items';

import { buildIndex } from './buildIndex.ts';
import { initialStackOf, type OpenContext, readOpenContext } from './context.ts';
import { labelsFor, resolveLanguage } from './language.ts';
import { emptySearchRunner, type SearchRunner } from './search.ts';
import { type ConnectedSpaces, readConnectedSpaces } from './spaces.ts';

/** 1 回開いている間に変わらないもの。閉じて開き直すと作り直す */
export type OpenSession = {
  openedAt: number;
  context: OpenContext;
  index: PaletteIndex;
  labels: Labels;
  store: PaletteStore;
  runner: SearchRunner;
};

/** 開く要求は受けたが索引がまだ無い。この間の打鍵は sink が受け、開いたときに入力へ写す */
export type OpeningPhase = { kind: 'opening' };
export type OpenPhase = { kind: 'open'; session: OpenSession };
export type Phase = OpeningPhase | OpenPhase | undefined;

type Prepared = {
  context: OpenContext;
  index: PaletteIndex;
  labels: Labels;
  connected: ConnectedSpaces;
};

async function prepare(): Promise<Prepared | undefined> {
  const context = await readOpenContext();
  if (context === undefined) return undefined;
  const now = Date.now();
  const [connected, prefs] = await Promise.all([readConnectedSpaces(), settings.getValue()]);
  const language = resolveLanguage(prefs.language, navigator.language);
  const index = await buildIndex({ context, connected, settings: prefs, language, now });
  document.documentElement.dataset.colorScheme = prefs.theme === 'system' ? undefined : prefs.theme;
  return { context, index, labels: labelsFor(language), connected };
}

function openWith(prepared: Prepared, typed: string): OpenSession {
  const { context, index, labels, connected } = prepared;
  const now = Date.now();
  const store = createPaletteStore();
  store.dispatch({
    type: 'opened',
    stack: initialStackOf(context, connected.get(context.spaceHost)),
  });
  if (typed !== '') store.dispatch({ type: 'inputChanged', value: typed });
  return {
    openedAt: now,
    context,
    index: { ...index, now },
    labels,
    store,
    runner: emptySearchRunner,
  };
}

/*
 * 用意済みの文脈が今のページのものかを、content script のヒントと突き合わせる。ヒントは
 * 「作り直すか」の判断にだけ使い、スペースや鍵の選択には使わない（I7）。合わなければ
 * tabs API から読み直す
 */
function matchesHint(context: OpenContext, hint: PageContext): boolean {
  return hint.origin === context.origin && hint.pathname === context.pathname;
}

/**
 * content script の open / close に合わせてセッションを作り、閉じる。
 *
 * storage の読み込みを open のたびに待つと、⌘K 直後の打鍵が Palette のマウント前に届いて
 * 落ちる。iframe の読み込み時と閉じたときに先に用意しておき（palette.md §3 の 100ms 予算）、
 * 間に合わないときは sink が打鍵を受けて開いたときに入力へ写す。表示・非表示は
 * content script が iframe ごと切り替える
 */
export function useOpenSession(channel: HostChannel) {
  const [phase, setPhase] = useState<Phase>();
  const prepared = useRef<Promise<Prepared | undefined>>(prepare());
  const typed = useRef('');

  const close = useCallback(() => {
    setPhase(undefined);
    typed.current = '';
    channel.send({ t: 'close' });
    prepared.current = prepare();
  }, [channel]);

  useEffect(() => {
    const open = async (hint: PageContext) => {
      setPhase({ kind: 'opening' });
      const ready = await prepared.current;
      const fresh =
        ready !== undefined && matchesHint(ready.context, hint) ? ready : await prepare();
      // スペースの URL でなければ開かない。content script の判定と二重に守る（I7）
      if (fresh === undefined) {
        close();
        return;
      }
      // open が届く前に sink が受けた文字も含めて入力に写す。写した分は次回に持ち越さない
      setPhase({ kind: 'open', session: openWith(fresh, typed.current) });
      typed.current = '';
    };
    return channel.subscribe((message) => {
      if (message.t === 'close') {
        setPhase(undefined);
        typed.current = '';
        prepared.current = prepare();
      } else void open(message.ctx);
    });
  }, [channel, close]);

  const onTyped = useCallback((value: string) => {
    typed.current = value;
  }, []);

  return { phase, close, onTyped };
}
