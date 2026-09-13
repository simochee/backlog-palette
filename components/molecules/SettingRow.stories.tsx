import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';

import { Switch } from '@/components/atoms/Switch';

import { SettingRow } from './SettingRow';

const meta = {
  component: SettingRow,
  args: {
    label: '並び順の学習',
    description: 'オフにすると行動ログの記録と frecency の反映を止めます。既存のログは消しません',
    htmlFor: 'learning',
    control: <Switch id="learning" checked onCheckedChange={fn()} />,
  },
  decorators: [
    (Story) => (
      <div className="rounded-surface bg-floating px-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SettingRow>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithDescription: Story = {
  name: 'ラベル・説明・コントロール',
};

export const LabelOnly: Story = {
  name: '説明なし',
  args: { description: undefined },
};
