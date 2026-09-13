import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@/components/tokens/tailwind.css';

import { ConnectApp } from './ConnectApp.tsx';

const root = document.querySelector('#root');
if (root === null) throw new Error('#root が無い');

createRoot(root).render(
  <StrictMode>
    <ConnectApp />
  </StrictMode>,
);
