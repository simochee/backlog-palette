import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { LabelsProvider, labelsFor } from '@/components/labels';
import { resolveLanguage } from '@/lib/i18n/language';
import { settings } from '@/lib/storage/palette-items';

import '@/components/tokens/tailwind.css';

import { ConnectApp } from './ConnectApp.tsx';

const root = document.querySelector('#root');
if (root === null) throw new Error('#root が無い');

// 接続バーも設定の言語に従う（surfaces.md §9・D-11）。描く前に設定を読み、描き直しで文言が変わらないようにする
const prefs = await settings.getValue();
const labels = labelsFor(resolveLanguage(prefs.language, navigator.language));

createRoot(root).render(
  <StrictMode>
    <LabelsProvider labels={labels}>
      <ConnectApp />
    </LabelsProvider>
  </StrictMode>,
);
