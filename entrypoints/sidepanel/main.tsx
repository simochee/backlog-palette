import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { SidePanel } from './SidePanel.tsx';

const root = document.querySelector('#root');
if (root === null) throw new Error('#root が無い');

createRoot(root).render(
  <StrictMode>
    <SidePanel />
  </StrictMode>,
);
