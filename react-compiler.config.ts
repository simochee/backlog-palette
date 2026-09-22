import babel from '@rolldown/plugin-babel';
import { reactCompilerPreset } from '@vitejs/plugin-react';

/**
 * 拡張のビルドと Storybook（= story のテスト）の両方に同じ React Compiler を載せる。
 *
 * oxc の Rust 版（`react({ compiler: true })`）は使わない。experimental で、有効にすると
 * plugin-react が開発サーバの Fast Refresh を切る（tech-stack.md §6 T-12）。
 *
 * 既定の panicThreshold は、規則を破ったコンポーネントを黙って最適化から外す。それでは
 * メモ化が効いているかをビルドの成否で知れないので、1 件でも外れたら落とす
 */
export const reactCompiler = () =>
  babel({ presets: [reactCompilerPreset({ panicThreshold: 'all_errors' })] });
