import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import { ja } from '@/components/labels';
import { projects, spaces } from '@/components/fixtures/domain';
import type { PathSegmentView } from '@/components/types';

import { ScopePath } from './ScopePath';

const root: PathSegmentView = { id: 'root', label: ja.palette.rootScope };
const space: PathSegmentView = { id: 'space', label: spaces.nulab.label, badge: true };
const project: PathSegmentView = { id: 'project', label: projects.web.name, badge: true };
const command: PathSegmentView = { id: 'command', label: ja.rows.switchSpace };

const meta = {
  component: ScopePath,
  args: { segments: [space, project] },
} satisfies Meta<typeof ScopePath>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Root: Story = {
  name: '根',
  args: { segments: [root] },
};

export const OneLevel: Story = {
  name: '1 段',
  args: { segments: [space] },
};

export const TwoLevels: Story = {
  name: '2 段',
};

export const CommandLevel: Story = {
  name: 'コマンド階層',
  args: { segments: [space, project, command] },
};

export const Armed: Story = {
  name: '削除待ちの段は取り消し線で示される',
  args: { segments: [space, { ...project, armed: true }] },
  play: async ({ canvasElement }) => {
    const label = within(canvasElement).getByText(projects.web.name);

    await expect(getComputedStyle(label).textDecorationLine).toContain('line-through');
  },
};

export const Narrow: Story = {
  name: '幅が足りないと左の段がバッジだけになる',
  globals: { width: '360' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText(spaces.nulab.label)).not.toBeVisible();
    await expect(canvas.getByLabelText(spaces.nulab.label)).toBeVisible();
    await expect(canvas.getByText(projects.web.name)).toBeVisible();
  },
};
