import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';

import { Button } from '@/components/atoms/Button';
import { Switch } from '@/components/atoms/Switch';
import { customHosts, spaceItemsWithExpired } from '@/components/fixtures';
import { ja } from '@/components/labels';
import { SettingRow } from '@/components/molecules/SettingRow';
import { CustomDomainForm } from '@/components/organisms/CustomDomainForm';
import { SpaceList } from '@/components/organisms/SpaceList';

import { OptionsLayout } from './OptionsLayout';

const meta = {
  component: OptionsLayout,
  args: {
    title: ja.brand,
    sections: [
      {
        id: 'spaces',
        title: ja.options.spacesTitle,
        children: (
          <SpaceList spaces={spaceItemsWithExpired} onReconnect={fn()} onDisconnect={fn()} />
        ),
      },
      {
        id: 'display',
        title: '表示',
        children: (
          <>
            <SettingRow
              label="配色"
              description="システムに追従／ライト／ダーク"
              control={<Button variant="secondary">システムに追従</Button>}
            />
            <SettingRow
              label="言語"
              description="ブラウザに従う／日本語／English"
              control={<Button variant="secondary">ブラウザに従う</Button>}
            />
          </>
        ),
      },
      {
        id: 'custom-domain',
        title: ja.options.customDomain.title,
        description: ja.options.customDomain.description,
        children: <CustomDomainForm hosts={customHosts} onAdd={fn()} onRemove={fn()} />,
      },
      {
        id: 'learning',
        title: '学習',
        children: (
          <>
            <SettingRow
              label="並び順の学習"
              htmlFor="learning"
              control={<Switch id="learning" checked onCheckedChange={fn()} />}
            />
            <SettingRow
              label="履歴を消去"
              description="行動ログ・表示キャッシュ・検索履歴・クエリ辞書を消します。接続とキーは残ります"
              control={
                <Button variant="secondary" tone="danger">
                  消去
                </Button>
              }
            />
          </>
        ),
      },
    ],
  },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof OptionsLayout>;

export default meta;

type Story = StoryObj<typeof meta>;

export const OneColumn: Story = {
  name: '1 カラム配置',
};

export const Narrow: Story = {
  name: '幅 360',
  globals: { width: '360' },
};
