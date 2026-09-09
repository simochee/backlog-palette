import type { ReactNode } from 'react';
import { Button as AriaButton } from 'react-aria-components';
import styles from './controls.module.css';

export type ButtonTone = 'default' | 'danger';

export type ButtonProps = {
  children: ReactNode;
  tone?: ButtonTone;
  isDisabled?: boolean;
  onPress?: () => void;
};

export function Button({ children, tone = 'default', isDisabled = false, onPress }: ButtonProps) {
  return (
    <AriaButton
      className={`${styles.button} ${styles.focusable}`}
      data-tone={tone}
      isDisabled={isDisabled}
      onPress={onPress}
    >
      {children}
    </AriaButton>
  );
}
