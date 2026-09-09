import { Radio, RadioGroup } from 'react-aria-components';
import styles from './controls.module.css';

export type Choice<T extends string> = { value: T; label: string };

export type ChoiceGroupProps<T extends string> = {
  /** 見えるラベルは行側が持つので、ここは支援技術に読ませる名前 */
  label: string;
  value: T;
  choices: readonly Choice<T>[];
  onChange: (value: T) => void;
};

export function ChoiceGroup<T extends string>({
  label,
  value,
  choices,
  onChange,
}: ChoiceGroupProps<T>) {
  return (
    <RadioGroup
      className={styles.choiceGroup}
      aria-label={label}
      orientation="horizontal"
      value={value}
      onChange={(next) => {
        // RadioGroup が返すのは string なので、選択肢から引き直して T に戻す
        const chosen = choices.find((choice) => choice.value === next);
        if (chosen) onChange(chosen.value);
      }}
    >
      {choices.map((choice) => (
        <Radio
          key={choice.value}
          className={`${styles.choice} ${styles.focusable}`}
          value={choice.value}
        >
          {choice.label}
        </Radio>
      ))}
    </RadioGroup>
  );
}
