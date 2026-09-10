import { ChevronDown } from 'lucide-react';
import { Button as AriaButton, ListBox, ListBoxItem, Popover, Select } from 'react-aria-components';
import { Button } from '../primitives/Button.tsx';
import { Marker } from '../primitives/Marker.tsx';
import type { MarkerTone } from '../primitives/types.ts';
import styles from './FilterBar.module.css';

export type FilterOption = {
  id: string;
  label: string;
  count?: number;
  /** ステータスのように色で区別される選択肢はバッジで出す */
  tone?: MarkerTone;
};

export type FilterField = {
  id: string;
  label: string;
  /** 選択中の選択肢の id */
  value: string;
  /**
   * 選択肢。Backlog の検索は OR ができないので条件は単一選択で、
   * 「未対応か処理中」のような要求は「完了を除く」のようなプリセットを
   * この配列に混ぜて吸収する（§3 D5）。
   */
  options: readonly FilterOption[];
  /** 無条件を表す選択肢の id。value がこれと違う項目を「効いている条件」として示す */
  neutralValue?: string;
};

export type FilterBarProps = {
  fields: readonly FilterField[];
  /** 高さと文字を詰める（幅 480px 未満） */
  compact?: boolean;
  /**
   * ドロップダウンを描く先。
   *
   * 既定の document.body に出すと、トークンを定義している [data-bp-theme] の
   * 外に出てしまい、色も寸法も解決されない。サーフェスの中に描かせる。
   */
  portalContainer?: Element;
  onChange?: (fieldId: string, optionId: string) => void;
  onClear?: () => void;
};

function isActive(field: FilterField): boolean {
  return field.neutralValue !== undefined && field.value !== field.neutralValue;
}

function FilterSelect({
  field,
  portalContainer,
  onChange,
}: {
  field: FilterField;
  portalContainer?: Element;
  onChange?: (fieldId: string, optionId: string) => void;
}) {
  const selected = field.options.find((option) => option.id === field.value);

  return (
    <Select
      className={styles.select}
      aria-label={field.label}
      selectedKey={field.value}
      onSelectionChange={(key) => onChange?.(field.id, String(key))}
    >
      <AriaButton className={styles.trigger} data-active={isActive(field) || undefined}>
        <span className={styles.triggerLabel}>{field.label}</span>
        <span className={styles.triggerValue}>{selected?.label ?? '指定なし'}</span>
        <ChevronDown size={12} strokeWidth={2} aria-hidden />
      </AriaButton>

      <Popover
        className={styles.popover}
        placement="bottom start"
        UNSTABLE_portalContainer={portalContainer}
      >
        <p className={styles.popoverNote}>1 つだけ選べます</p>
        <ListBox className={styles.options} items={field.options}>
          {(option: FilterOption) => (
            <ListBoxItem id={option.id} textValue={option.label} className={styles.option}>
              {({ isSelected }) => (
                <>
                  <span
                    className={styles.radio}
                    data-selected={isSelected || undefined}
                    aria-hidden
                  />
                  {option.tone ? (
                    <Marker label={option.label} tone={option.tone} dot />
                  ) : (
                    <span className={styles.optionLabel}>{option.label}</span>
                  )}
                  <span className={styles.optionSpacer} />
                  {option.count === undefined ? null : (
                    <span className={styles.optionCount}>{option.count}</span>
                  )}
                </>
              )}
            </ListBoxItem>
          )}
        </ListBox>
      </Popover>
    </Select>
  );
}

/**
 * サイドパネルの常設フィルターバー（§3 D5）。
 *
 * 選択肢を単一選択のラジオとして描くのは見た目の趣味ではなく制約の表示で、
 * 複数選べると誤解させると「未対応と処理中を両方」を試して 0 件に落ちる。
 */
export function FilterBar({
  fields,
  compact = false,
  portalContainer,
  onChange,
  onClear,
}: FilterBarProps) {
  const activeCount = fields.filter(isActive).length;

  return (
    <div className={styles.bar} data-compact={compact || undefined}>
      {fields.map((field) => (
        <FilterSelect
          key={field.id}
          field={field}
          portalContainer={portalContainer}
          onChange={onChange}
        />
      ))}

      <span className={styles.spacer} />
      <span className={styles.note}>条件はすべて AND</span>

      {activeCount > 0 && onClear ? (
        <Button onPress={onClear}>条件をクリア（{activeCount}）</Button>
      ) : null}
    </div>
  );
}
