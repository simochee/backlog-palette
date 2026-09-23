import { StrictMode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';

import '@/components/tokens/tailwind.css';
import './palette.css';

import { applyBacklogColorScheme } from './colorScheme.ts';
import { startPaletteController } from './controller.ts';
import { hostChannel } from './hostChannel.ts';
import { PaletteApp } from './PaletteApp.tsx';

// iframe を作った時点の Backlog のテーマ。content script が URL に載せる
applyBacklogColorScheme(new URLSearchParams(window.location.search).get('colorScheme'));

const root = document.querySelector('#root');
if (root === null) throw new Error('#root が無い');

const controller = startPaletteController(hostChannel);

const reactRoot = createRoot(root);
/*
 * render() だけでは最初の commit が scheduler のタスクに回り、iframe の load より後になりうる。
 * content script は load で開いて iframe にフォーカスを移し、入力イベントはそのタスクを追い越す。
 * 入力欄が無い間の打鍵は document に落ちる。同期に commit すれば、モジュールスクリプトが
 * load を待たせている間に入力欄と useKeepFocus の購読が揃う
 */
flushSync(() => {
  reactRoot.render(
    <StrictMode>
      <PaletteApp controller={controller} />
    </StrictMode>,
  );
});
