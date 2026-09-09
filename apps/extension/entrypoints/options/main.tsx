import { createRoot } from 'react-dom/client';
import { Options } from './Options.tsx';
import '@backlog-palette/ui/tokens.css';
import './options.css';

const root = document.getElementById('root');
if (root === null) throw new Error('#root not found');

createRoot(root).render(<Options />);
