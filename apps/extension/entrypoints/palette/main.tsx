import { createRoot } from 'react-dom/client';
import { Palette } from './Palette.tsx';
import '@backlog-palette/ui/tokens.css';
import './palette.css';

const root = document.getElementById('root');
if (root === null) throw new Error('#root not found');

createRoot(root).render(<Palette />);
