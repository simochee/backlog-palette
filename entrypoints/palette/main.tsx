import { StrictMode } from 'react';
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

// ページの寿命と同じだけ購読する。effect に置くと StrictMode の再実行で open を 2 回処理する
const controller = startPaletteController(hostChannel);

createRoot(root).render(
  <StrictMode>
    <PaletteApp controller={controller} />
  </StrictMode>,
);
