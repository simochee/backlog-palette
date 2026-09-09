import { createRoot } from 'react-dom/client';
import { createHostChannel } from '../../src/messaging/hostChannel.ts';
import { Palette } from './Palette.tsx';
import '@backlog-palette/ui/tokens.css';
import './palette.css';

// React のマウントより先に張る。理由は createHostChannel の説明にある
const channel = createHostChannel(window);

const root = document.getElementById('root');
if (root === null) throw new Error('#root not found');

createRoot(root).render(<Palette channel={channel} />);
