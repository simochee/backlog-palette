import type { Meta, StoryObj } from '@storybook/react-vite';
import { Row } from './Row.tsx';

const meta = {
  title: 'palette/Row',
  component: Row,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div style={{ width: 616, background: 'var(--bp-surface-floating)', padding: 6 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Row>;

export default meta;
type Story = StoryObj<typeof meta>;

export const 課題: Story = {
  args: {
    kind: 'issue',
    code: 'PROJ-142',
    title: '決済フローのエラーハンドリング',
    sub: 'Webリニューアル · 田中 拓也',
    marker: { label: '処理中', tone: 'info' },
    tag: { label: 'バグ', tone: 'danger' },
    hint: 'enter',
  },
};

export const 選択中: Story = { args: { ...課題.args, selected: true } };

export const 第一候補: Story = {
  args: {
    kind: 'filter',
    title: '「ログイン」をサイドパネルで検索',
    sub: '課題・Wiki・ドキュメントを全文検索',
    tone: 'accent',
    hint: 'enter',
  },
};

export const 未接続: Story = {
  args: {
    kind: 'connect',
    title: 'acme は未接続 — 接続する',
    sub: '接続すると acme の課題・Wiki も同じ検索に含まれます',
    tone: 'danger',
    hint: 'enter',
  },
};

export const 全スペース時: Story = {
  args: { ...課題.args, avatar: { label: 'acme' } },
};

export const 二段階操作: Story = {
  args: { kind: 'command', title: 'ステータスを変更', sub: 'コマンド · PROJ-123', hint: 'more' },
};

/** 日本語の長い件名で省略が効くか。モックの寸法を信じずに崩れ方を見る */
export const 長い件名: Story = {
  args: {
    ...課題.args,
    title: '請求書テンプレートの差し替えと Wiki からの参照リンクの張り替えを同時に行う対応',
    sub: '社内ヘルプデスク · 山本 遼 · 最終更新 3 日前 · コメント 12 件',
  },
};

export const 全種別: Story = {
  args: 課題.args,
  render: () => (
    <>
      {(
        [
          'issue',
          'wiki',
          'document',
          'project',
          'space',
          'page',
          'command',
          'user',
          'connect',
          'filter',
          'external',
        ] as const
      ).map((kind) => (
        <Row key={kind} kind={kind} title={kind} sub="種別アイコンの一覧" />
      ))}
    </>
  ),
};
