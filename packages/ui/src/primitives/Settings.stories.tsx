import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Button } from './Button.tsx';
import { ChoiceGroup } from './ChoiceGroup.tsx';
import { Marker } from './Marker.tsx';
import { Section } from './Section.tsx';
import { SettingRow } from './SettingRow.tsx';
import { Switch } from './Switch.tsx';

const meta = {
  title: 'primitives/Settings',
  component: Section,
  decorators: [
    (Story) => (
      <div style={{ width: 'min(720px, 100%)' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Section>;

export default meta;
type Story = StoryObj<typeof meta>;

function LearningSwitch({ initial = true }: { initial?: boolean }) {
  const [on, setOn] = useState(initial);
  return <Switch label="よく使う項目を学習して並び替える" isSelected={on} onChange={setOn} />;
}

function SurfaceChoice() {
  const [surface, setSurface] = useState<'modal' | 'panel'>('modal');
  return (
    <ChoiceGroup
      label="既定のサーフェス"
      value={surface}
      choices={[
        { value: 'modal', label: 'モーダル' },
        { value: 'panel', label: 'サイドパネル' },
      ]}
      onChange={setSurface}
    />
  );
}

export const 設定セクション: Story = {
  args: { title: '', children: null },
  render: () => (
    <Section title="学習と履歴" description="記録はすべて端末内に残ります。いつでも消去できます。">
      <SettingRow
        label="よく使う項目を学習して並び替える"
        description="開いた回数と直近の利用をローカルに記録し、候補の順序に反映します。サーバーには送信しません。"
        control={<LearningSwitch />}
      />
      <SettingRow
        label="ブラウザ履歴から最近の課題を取り込む"
        description="履歴の読み取り権限を追加で要求します。対象は *.backlog.jp / *.backlog.com のみ。取り込んだ内容は端末内に保存され、いつでも消去できます。"
        control={<LearningSwitch initial={false} />}
      />
      <SettingRow
        label="記録した履歴を消去する"
        description="最近開いた課題・Wiki と、並び替えに使っている記録が消えます。接続済みスペースと設定は残ります。"
        control={<Button tone="danger">履歴を消去</Button>}
      />
    </Section>
  ),
};

export const 選択肢の行: Story = {
  args: { title: '', children: null },
  render: () => (
    <Section title="パレットの開き方" description="⌘K を押したときに何が出るかを決めます。">
      <SettingRow
        label="既定のサーフェス"
        description="サイドパネルは ⌘⇧K でいつでも開けます。"
        control={<SurfaceChoice />}
      />
    </Section>
  ),
};

/** 状態バッジと、まだ押せないボタンが同じ行に並ぶ形 */
export const 接続済みスペース: Story = {
  args: { title: '', children: null },
  render: () => (
    <Section
      title="接続済みスペース"
      description="スペースの接続・再接続・削除は、まだこの画面からは行えません。"
    >
      <SettingRow
        label="ヌーラボ"
        description="nulab.backlog.jp · OAuth · 3 時間前に同期"
        control={
          <>
            <Marker label="接続済み" tone="success" dot />
            <Button isDisabled>削除</Button>
          </>
        }
      />
      <SettingRow
        label="acme"
        description="acme.backlog.com · API キー · 12 日前に同期"
        control={
          <>
            <Marker label="要再接続" tone="warning" dot />
            <Button isDisabled>再接続</Button>
            <Button isDisabled>削除</Button>
          </>
        }
      />
      <SettingRow
        label="接続済みのスペースはまだありません"
        description="Backlog のページで ⌘K を押すと、その場で接続できます。"
      />
    </Section>
  ),
};
