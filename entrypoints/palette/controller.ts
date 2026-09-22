import { createStore, type Store } from '@tanstack/store';

import { isPaletteHotkey } from '@/lib/hotkey/paletteHotkey';
import type { HostChannel } from '@/lib/messaging/hostChannel';
import { createPaletteStore, type PaletteStore } from '@/lib/palette';
import type { Readable } from '@/lib/store';
import { applyBacklogTheme, parseBacklogTheme } from '@/lib/theme/backlogTheme';

import { type Pending, restartSearch } from './actions.ts';
import { applyBacklogColorScheme } from './colorScheme.ts';
import { createSession, type PaletteSession } from './createSession.ts';
import { handOffToPanel, isPanelAvailable } from './panel.ts';
import { watchConnectedSpaces } from './spaces.ts';
import { paletteTelemetry } from './telemetry.ts';

/*
 * Firefox はサイドバーをスクリプトから開けないので、開いているときだけ ⌘→ と panel 行を出す
 * （surfaces.md §5.5）。材料は開く前に用意しておくので、開閉は開いた時点で訊き直す。
 * 答えが届くまでは出さない。出してから消すと、押せないキーを一瞬見せることになる（I2）
 */
const PANEL_ALWAYS_AVAILABLE = import.meta.env.BROWSER !== 'firefox';

/** openedAt は開いた時刻。presenter が入力欄へフォーカスを戻す合図に使う */
export type Surface = { open: boolean; openedAt: number; panelAvailable: boolean };

/** スペースの URL でなければ null。パレットを持たない（I7） */
type Supplied = PaletteSession | null;

/**
 * 用意した材料。用意は非同期で重なる（接続の保存は鍵と記録の 2 回の書き込み）ので、
 * 最後に頼んだものだけを反映し、遅れて終わった古い方で上書きしない
 */
function createSessionSupply() {
  const current = createStore<Supplied>(null);
  let inflight: Promise<Supplied> | undefined;
  let settled = false;

  const refresh = async (): Promise<Supplied> => {
    const next = createSession().then((ready) => ready ?? null);
    inflight = next;
    const ready = await next;
    if (inflight === next) {
      settled = true;
      current.setState(() => ready);
    }
    return ready;
  };

  /*
   * 一度でも用意が終わっていれば、進行中の用意し直しは待たず、直前の材料で同期に渡す。
   * await を挟むと、その間に打たれた文字が入力欄に入った後で open が届き、状態のリセットで
   * 消える。まだ一度も終わっていないときだけ、進行中の用意を待つ
   */
  const whenReady = (receive: (session: Supplied) => void) => {
    if (settled) receive(current.state);
    else void inflight?.then(receive);
  };

  void refresh();
  return { current, refresh, whenReady };
}

type Opening = {
  channel: HostChannel;
  store: PaletteStore;
  pending: Pending;
  close: () => void;
};

/*
 * 開くたびに状態を開いた形へ戻す。前回の入力・選択・検索は残さない（palette.md §3）。
 * 共有 URL で開いたときはここで復元する。条件つきはサイドパネルへ渡し、開けない環境
 * （Firefox）では語とスコープだけパレットで復元する（surfaces.md §5.1・§5.5）
 */
function applyOpen(session: Supplied, { channel, store, pending, close }: Opening): void {
  if (session === null) {
    channel.send({ t: 'close' });
    return;
  }
  store.dispatch({ type: 'opened', stack: session.stack });
  const { restore } = session;
  if (restore === undefined) return;
  void (async () => {
    if (restore.toPanel && (await handOffToPanel(restore.state))) {
      close();
      return;
    }
    store.dispatch({ type: 'inputChanged', value: restore.query });
    restartSearch(
      restore.query,
      restore.scope,
      { runner: session.runner, dispatch: store.dispatch },
      pending,
    );
  })();
}

// 前に開いたときの答えは使わない。その後にサイドバーが閉じているかもしれない
async function askPanelAvailable(surface: Store<Surface>, openedAt: number): Promise<void> {
  const available = await isPanelAvailable();
  surface.setState((previous) =>
    previous.openedAt === openedAt ? { ...previous, panelAvailable: available } : previous,
  );
}

function closeOnPaletteHotkey(close: () => void): void {
  window.addEventListener(
    'keydown',
    (event) => {
      // 開いているときの ⌘K は閉じる（D-8）。iframe にフォーカスがあると content script には届かない
      if (event.isComposing || !isPaletteHotkey(event, navigator.platform)) return;
      event.preventDefault();
      close();
    },
    { capture: true },
  );
}

export type PaletteController = {
  session: Readable<Supplied>;
  surface: Readable<Surface>;
  store: PaletteStore;
  pending: Pending;
  close: () => void;
};

/**
 * content script の open / close に合わせて、パレットの材料を用意し続ける。
 *
 * 材料は `open` を待たずに作る。待ってから描くと、iframe が表示された直後の打鍵が
 * まだ存在しない入力欄に届かず落ちる（mvp の罠と同じ形）。閉じている間も描いておき、
 * content script の `iframe.focus()` がそのまま入力欄のフォーカスになる。
 *
 * React の外に置くのは、open の処理を同期で終えるため。effect の中で購読すると、
 * 開いた直後の打鍵と「開いた形へ戻す」の順序が描画の都合で決まる
 */
export function startPaletteController(channel: HostChannel): PaletteController {
  const store = createPaletteStore();
  const pending: Pending = { search: undefined, lastSearch: undefined };
  const surface = createStore<Surface>({
    open: false,
    openedAt: 0,
    panelAvailable: PANEL_ALWAYS_AVAILABLE,
  });
  const supply = createSessionSupply();

  const hide = () => {
    surface.setState((previous) => ({ ...previous, open: false }));
    void supply.refresh();
  };
  const close = () => {
    channel.send({ t: 'close' });
    hide();
  };
  const show = (colorScheme: string | undefined) => {
    // 読み込み後に Backlog 側でテーマを切り替えていても、開くたびに追いつく
    applyBacklogColorScheme(colorScheme);
    const openedAt = Date.now();
    surface.setState(() => ({ open: true, openedAt, panelAvailable: PANEL_ALWAYS_AVAILABLE }));
    if (!PANEL_ALWAYS_AVAILABLE) void askPanelAvailable(surface, openedAt);
    paletteTelemetry.opened();
    supply.whenReady((session) => applyOpen(session, { channel, store, pending, close }));
  };

  channel.subscribe((message) => {
    if (message.t === 'theme')
      applyBacklogTheme(document.documentElement, parseBacklogTheme(message.theme));
    else if (message.t === 'close') hide();
    else show(message.ctx.colorScheme);
  });
  /*
   * 用意は iframe の読み込み時と閉じた時にしか走らない。同じページの貼り付けバーで接続すると、
   * 次の ⌘K が接続前に用意した「未接続」の材料で開いてしまうため、接続の変化でも用意し直す
   */
  watchConnectedSpaces(() => void supply.refresh());
  closeOnPaletteHotkey(close);

  return { session: supply.current, surface, store, pending, close };
}
