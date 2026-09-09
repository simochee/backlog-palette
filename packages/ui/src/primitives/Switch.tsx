import { Switch as AriaSwitch } from 'react-aria-components';
import styles from './controls.module.css';

export type SwitchProps = {
  /** 見えるラベルは行側が持つので、ここは支援技術に読ませる名前 */
  label: string;
  isSelected: boolean;
  onChange: (isSelected: boolean) => void;
  isDisabled?: boolean;
};

export function Switch({ label, isSelected, onChange, isDisabled = false }: SwitchProps) {
  return (
    <AriaSwitch
      className={`${styles.switch} ${styles.focusable}`}
      aria-label={label}
      isSelected={isSelected}
      onChange={onChange}
      isDisabled={isDisabled}
    >
      <span className={styles.switchTrack}>
        <span className={styles.switchKnob} />
      </span>
    </AriaSwitch>
  );
}
