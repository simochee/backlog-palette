import { createRoot } from 'react-dom/client';
import '@backlog-palette/ui/tokens.css';

/**
 * M0 スパイク: commands からサイドパネルを開けるか（実装プラン §18-6）。
 * 検索 UI は M4。ここでは表示経路とラグだけを確かめる。
 */
const root = document.getElementById('root');
if (root === null) throw new Error('#root not found');

createRoot(root).render(
  <div data-bp-theme="" style={{ padding: 16, fontFamily: 'var(--bp-font-body)' }}>
    <p style={{ font: '600 13.5px/20px var(--bp-font-body)', color: 'var(--bp-text-default)' }}>
      サイドパネルの表示経路の確認用
    </p>
    <p style={{ font: '400 11.5px/18px var(--bp-font-body)', color: 'var(--bp-text-subtle)' }}>
      検索 UI は M4 で入る。
    </p>
  </div>,
);
