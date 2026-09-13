import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { useState } from 'react';

import { filters } from '@/components/fixtures/panel';
import { ja } from '@/components/labels';
import type { FilterField } from '@/components/types';

import { FilterBar } from './FilterBar';

const meta = {
  component: FilterBar,
  args: { fields: filters(ja), onChange: fn(), onClearAll: fn() },
  decorators: [
    (Story) => (
      <div className="rounded-surface bg-floating p-3">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FilterBar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Neutral: Story = {
  name: '条件なし',
};

export const TwoActive: Story = {
  name: '2 条件が効いている（強調）',
  args: { fields: filters(ja, { type: 'issue', status: 'not-closed' }) },
};

export const Compact: Story = {
  name: 'compact',
  args: { compact: true, fields: filters(ja, { type: 'issue' }) },
};

export const BuiltinStatusesOnly: Story = {
  name: 'プロジェクトが「すべて」でステータスが組み込みだけ',
  args: {
    fields: filters(ja).map((field) => {
      if (field.id !== 'status') return field;
      return { id: field.id, label: field.label, value: field.value, neutralValue: field.neutralValue, options: field.options.slice(0, 6) };
    }),
  },
};

export const SingleChoice: Story = {
  name: '選択肢は 1 つだけ選べる',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: new RegExp(ja.panel.fields.type, 'u') }));

    const group = await within(document.body).findByRole('radiogroup', { name: ja.panel.fields.type });
    await expect(within(group).getAllByRole('radio')).toHaveLength(4);
    await expect(within(document.body).getByText(ja.panel.singleChoice)).toBeVisible();

    await userEvent.click(within(group).getByRole('radio', { name: ja.panel.options.wiki }));

    await expect(args.onChange).toHaveBeenCalledTimes(1);
    await expect(args.onChange).toHaveBeenCalledWith('type', 'wiki');
  },
};

const withValue = (field: FilterField, value: string): FilterField => ({
  id: field.id,
  label: field.label,
  value,
  neutralValue: field.neutralValue,
  options: field.options,
});

function Controlled({ initial }: { initial: FilterField[] }) {
  const [fields, setFields] = useState(initial);
  return (
    <FilterBar
      fields={fields}
      onChange={(fieldId, optionId) =>
        setFields((current) => current.map((field) => withValue(field, fieldId === field.id ? optionId : field.value)))
      }
      onClearAll={() =>
        setFields((current) => current.map((field) => withValue(field, field.neutralValue ?? field.value)))
      }
    />
  );
}

export const BackToNeutral: Story = {
  name: 'neutral に戻すと強調が消える',
  render: () => <Controlled initial={filters(ja, { type: 'issue' })} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = () => canvas.getByRole('button', { name: new RegExp(ja.panel.fields.type, 'u') });
    await expect(trigger()).toHaveAttribute('data-active', 'true');

    await userEvent.click(trigger());
    const group = await within(document.body).findByRole('radiogroup', { name: ja.panel.fields.type });
    await userEvent.click(within(group).getByRole('radio', { name: ja.panel.options.all }));

    await expect(trigger()).not.toHaveAttribute('data-active');
  },
};

export const ClearAllKeepsScope: Story = {
  name: '「条件をすべて外す」でスコープは変わらない',
  args: { fields: filters(ja, { space: 'nulab', type: 'issue' }) },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole('button', { name: ja.panel.clearFilters }));

    await expect(args.onClearAll).toHaveBeenCalledTimes(1);
    await expect(args.onChange).not.toHaveBeenCalled();
  },
};
