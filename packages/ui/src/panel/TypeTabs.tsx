import type { ReactNode } from 'react';
import { Tab, TabList, TabPanel, Tabs } from 'react-aria-components';
import styles from './TypeTabs.module.css';

export type TypeTab = {
  id: string;
  label: string;
  count?: number;
};

export type TypeTabsProps = {
  tabs: readonly TypeTab[];
  selected: string;
  onSelect: (id: string) => void;
  /** 支援技術に読ませる名前 */
  label?: string;
  /** 選択中のタブに対応する内容（結果リスト） */
  children?: ReactNode;
};

/**
 * 広い幅でセクション見出しの代わりに出す種別タブ（§5.3 の 860px 超）。
 */
export function TypeTabs({ tabs, selected, onSelect, label = '種別', children }: TypeTabsProps) {
  return (
    <Tabs
      className={styles.tabs}
      selectedKey={selected}
      onSelectionChange={(key) => onSelect(String(key))}
    >
      <TabList className={styles.list} aria-label={label} items={tabs}>
        {(tab: TypeTab) => (
          <Tab id={tab.id} className={styles.tab}>
            <span>{tab.label}</span>
            {tab.count === undefined ? null : <span className={styles.count}>{tab.count}</span>}
          </Tab>
        )}
      </TabList>

      {/*
       * タブごとに TabPanel を並べない。結果リストはタブを変えても同じ ListBox で、
       * 並べると切替のたびに再マウントされて選択位置とスクロールが飛ぶ（§3 D6-3）。
       * 選択中の id を持つ 1 枚だけ描けば、タブの aria-controls の参照先も保たれる。
       */}
      <TabPanel id={selected} className={styles.panel}>
        {children}
      </TabPanel>
    </Tabs>
  );
}
