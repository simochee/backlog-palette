import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  imports: false,
  manifest: {
    name: 'Backlog Palette',
    permissions: [],
  },
  vite: () => ({
    plugins: [tailwindcss()],
    css: { transformer: 'lightningcss' },
  }),
});
