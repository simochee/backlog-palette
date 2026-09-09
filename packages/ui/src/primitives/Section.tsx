import type { ReactNode } from 'react';
import styles from './settings.module.css';

export type SectionProps = {
  title: string;
  description?: ReactNode;
  children: ReactNode;
};

export function Section({ title, description, children }: SectionProps) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>{title}</h2>
        {description ? <p className={styles.sectionDescription}>{description}</p> : null}
      </div>
      <div className={styles.card}>{children}</div>
    </section>
  );
}
