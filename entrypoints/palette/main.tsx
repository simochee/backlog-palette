import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@/components/tokens/tailwind.css';
import './palette.css';

import { applyBacklogColorScheme } from './colorScheme.ts';
import { PaletteApp } from './PaletteApp.tsx';

// iframe を作った時点の Backlog のテーマ。content script が URL に載せる
applyBacklogColorScheme(new URLSearchParams(window.location.search).get('colorScheme'));

const root = document.querySelector('#root');
if (root === null) throw new Error('#root が無い');

createRoot(root).render(
  <StrictMode>
    <PaletteApp />
  </StrictMode>,
);
