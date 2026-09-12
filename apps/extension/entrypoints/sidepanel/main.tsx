import { createRoot } from 'react-dom/client';
import { Panel } from './Panel.tsx';
import '@backlog-palette/ui/tokens.css';
import './sidepanel.css';

const root = document.getElementById('root');
if (root === null) throw new Error('#root not found');

createRoot(root).render(<Panel />);
