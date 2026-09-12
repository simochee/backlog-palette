import { createRoot } from 'react-dom/client';
import { Connect } from './Connect.tsx';
import '@backlog-palette/ui/tokens.css';
import './connect.css';

const root = document.getElementById('root');
if (root === null) throw new Error('#root not found');

createRoot(root).render(<Connect />);
