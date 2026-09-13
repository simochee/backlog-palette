import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import { hintLabel, options, paletteCallbacks, s1, s6, spaces } from '@/components/fixtures';
import { en, ja, type Labels, LabelsProvider } from '@/components/labels';
import type { PaletteView } from '@/components/types';

import { Palette } from './Palette';
import { StatefulPalette } from './Palette.harness';

const meta = {
  title: 'organisms/Palette/variants',
  component: Palette,
  args: { ...s1(ja), ...paletteCallbacks() },
  render: (args) => <StatefulPalette {...args} />,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="relative h-screen">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Palette>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Narrow: Story = {
  name: '狭い幅（360） — ↵ が残り、補足が隠れ、パスがバッジだけになる',
  args: { ...s6(ja), path: s1(ja).path, width: 360 },
  globals: { width: '360' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(hintLabel(canvasElement, 'enter')).toContain(ja.keys.open);
    const issue = options(canvasElement).find((option) => option.dataset.kind === 'issue');
    const sub = issue?.querySelector('.truncate.\\@max-narrow\\:hidden');
    await expect(sub).not.toBeVisible();
    await expect(canvas.getByText(spaces.nulab.label)).not.toBeVisible();
  },
};

export const DarkS1: Story = {
  name: 'ダーク — S1',
  args: s1(ja),
  globals: { theme: 'dark' },
};

export const DarkS6: Story = {
  name: 'ダーク — S6',
  args: s6(ja),
  globals: { theme: 'dark' },
};

export const EnglishS1: Story = {
  name: 'English — S1',
  args: { ...s1(en), labels: en },
  globals: { locale: 'en' },
};

export const EnglishS6: Story = {
  name: 'English — S6（ラベルが長くても ↵ は残り、溢れた分は priority 順に落ちる）',
  args: { ...s6(en), labels: en },
  globals: { locale: 'en' },
  play: async ({ canvasElement }) => {
    await expect(hintLabel(canvasElement, 'enter')).toContain(en.keys.open);
    await expect(hintLabel(canvasElement, 'move')).toContain(en.keys.move);
  },
};

function Cell({
  theme,
  labels,
  width,
  view,
}: {
  theme: 'light' | 'dark';
  labels: Labels;
  width: number;
  view: PaletteView;
}) {
  return (
    <div
      data-color-scheme={theme}
      className="@container relative h-160 shrink-0 overflow-hidden rounded-surface bg-page"
      style={{ width }}
    >
      <LabelsProvider labels={labels}>
        <Palette {...view} {...paletteCallbacks()} labels={labels} width={width} />
      </LabelsProvider>
    </div>
  );
}

export const Matrix: Story = {
  name: '両テーマ・両言語・幅 360/640/720 で描画が落ちない',
  parameters: { layout: 'padded' },
  decorators: [(Story) => <Story />],
  render: () => (
    <div className="flex flex-col gap-4">
      {(['light', 'dark'] as const).map((theme) =>
        ([ja, en] as const).map((labels) => (
          <div key={`${theme}-${labels.palette.escClose}`} className="flex flex-wrap gap-4">
            {[360, 640, 720].map((width) => (
              <Cell key={width} theme={theme} labels={labels} width={width} view={s6(labels)} />
            ))}
          </div>
        )),
      )}
    </div>
  ),
};
