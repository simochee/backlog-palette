import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  allSpacesSections,
  commandArgSections,
  emptyStateSections,
  freeTextSections,
  issueKeySections,
  pathAllSpaces,
  pathProject,
} from '../fixtures/ja.ts';
import { PaletteSurface } from './PaletteSurface.tsx';

/**
 * モックのアートボード A1〜A8 に対応する。
 * 見た目の調整は拡張機能を起動せずにここで完結させる（§8.2）。
 */
const meta = {
  title: 'palette/PaletteSurface',
  component: PaletteSurface,
  parameters: { layout: 'centered' },
  args: { width: 640 },
} satisfies Meta<typeof PaletteSurface>;

export default meta;
type Story = StoryObj<typeof meta>;

export const A1_空状態: Story = {
  args: { path: pathProject, sections: emptyStateSections },
};

export const A2_ページ名を入力中: Story = {
  args: {
    path: pathProject,
    defaultValue: 'ぼーど',
    completion: 'ボード',
    sections: [
      {
        id: 'pages',
        rows: [
          {
            id: 'board',
            kind: 'page',
            title: 'ボード',
            sub: 'Webリニューアル · ページ',
            hint: 'enter',
          },
          { id: 'board-mob', kind: 'page', title: 'ボード', sub: 'モバイルアプリ v3 · ページ' },
          {
            id: 'cmd-board-add',
            kind: 'command',
            title: 'ボードに課題を追加',
            sub: 'コマンド · Webリニューアル',
            hint: 'more',
          },
          {
            id: 'board-settings',
            kind: 'page',
            title: 'ボードの設定',
            sub: 'Webリニューアル · ページ',
          },
        ],
      },
    ],
  },
};

export const A3_課題キーを入力中: Story = {
  args: { path: pathProject, defaultValue: 'PROJ-12', sections: issueKeySections },
};

export const A4a_自由テキスト: Story = {
  args: { path: pathProject, defaultValue: 'ログイン', sections: freeTextSections },
};

/** ⌫ の 1 回目。右端に取り消し線が付き、入力した日本語は消えない */
export const A4b_削除待ち: Story = {
  args: {
    path: [
      { label: 'nulab', avatar: true, labelHidden: true },
      { label: 'Webリニューアル', avatar: true, armed: true },
    ],
    defaultValue: 'ログイン',
    armedNotice: true,
    sections: freeTextSections,
    footer: [
      { keys: ['⌫'], label: '右端を 1 段削除（nulab / に戻る）' },
      { keys: ['⇥'], label: '候補を補完' },
      { keys: ['↵'], label: '開く' },
    ],
  },
};

export const A5_全スペース: Story = {
  args: { path: pathAllSpaces, defaultValue: '請求', sections: allSpacesSections },
};

export const A7_コマンドの二段階目: Story = {
  args: {
    path: [
      { label: 'nulab', avatar: true, labelHidden: true },
      { label: 'Webリニューアル', avatar: true },
      { label: 'ステータスを変更' },
    ],
    sections: commandArgSections,
    footer: [
      { keys: ['↑', '↓'], label: '移動' },
      { keys: ['↵'], label: '適用' },
      { keys: ['esc'], label: '1 つ前に戻る' },
    ],
  },
};

/** 640px より狭い幅でフッターのキーヒントが溢れないか */
export const 狭い幅: Story = {
  args: { path: pathProject, sections: emptyStateSections, width: 460 },
};
