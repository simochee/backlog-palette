import { Check, Search } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import { useRef, useState } from 'react';
import {
  Autocomplete,
  Header,
  Input,
  ListBox,
  ListBoxItem,
  ListBoxSection,
  TextField,
} from 'react-aria-components';
import type { FooterHint, PaletteSection } from '../palette/PaletteSurface.tsx';
import { Row } from '../palette/Row.tsx';
import { createSurfaceKeyHandler } from '../palette/surfaceKeys.ts';
import { Kbd } from '../primitives/Kbd.tsx';
import type { RowKind } from '../primitives/types.ts';
import { FilterBar, type FilterField } from './FilterBar.tsx';
import styles from './PanelSurface.module.css';
import { Preview, type PreviewProps } from './Preview.tsx';
import { type SpaceStatus, StatusStrip } from './StatusStrip.tsx';
import { type TypeTab, TypeTabs } from './TypeTabs.tsx';
import { usePanelLayout } from './usePanelLayout.ts';

/** 0 件の原因の切り分け（§13）。スコープと絞り込み条件を混ぜない */
export type PanelSuggestionGroup = 'condition' | 'scope' | 'external';

export type PanelSuggestion = {
  id: string;
  group: PanelSuggestionGroup;
  label: string;
  sub?: string;
};

export type PanelEmptyState = {
  title?: string;
  description?: string;
  suggestions: readonly PanelSuggestion[];
};

export type PanelToast = {
  message: string;
  /** 何がコピーされたかを実体で見せる（モック B5） */
  detail?: string;
};

export type PanelSurfaceProps = {
  sections: readonly PaletteSection[];
  /** 常設フィルターバーの項目。省略するとバーを出さない */
  filters?: readonly FilterField[];
  onFilterChange?: (fieldId: string, optionId: string) => void;
  onFilterClear?: () => void;
  /** スペース単位の進捗・件数・エラー */
  spaces?: readonly SpaceStatus[];
  statusSummary?: string;
  /** 広い幅でセクション見出しの代わりに出す種別タブ */
  tabs?: readonly TypeTab[];
  selectedTab?: string;
  onSelectTab?: (id: string) => void;
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  onValueChange?: (value: string) => void;
  /** プレビューの対象。狭い幅ではこの行の下に展開する */
  selectedId?: string;
  preview?: PreviewProps;
  previewPlaceholder?: string;
  /** 0 件のときに結果リストの代わりに出す提案 */
  emptyState?: PanelEmptyState;
  onSuggestion?: (id: string) => void;
  toast?: PanelToast;
  footer?: readonly FooterHint[];
  footerNote?: string;
  onAction?: (id: string) => void;
  /**
   * Enter を行の実行ではなく検索の実行に使うか。
   * 入力を変えた直後の Enter は検索、変えていなければ選択行を開く。
   */
  submitOnEnter?: boolean;
  onSubmit?: (value: string) => void;
  onEscape?: () => void;
  autoFocus?: boolean;
};

const DEFAULT_FOOTER: readonly FooterHint[] = [
  { keys: ['↑', '↓'], label: '移動' },
  { keys: ['↵'], label: '開く' },
  { keys: ['⌘', '⇧', 'C'], label: '検索 URL をコピー' },
];

/**
 * 提案は props の並び順ではなくこの順で出す。効いている条件を外す提案を
 * 先頭に固定するのが 0 件の切り分けの要点で、呼び出し側の都合で崩れると困る。
 */
const SUGGESTION_GROUPS = [
  { id: 'condition', label: '絞り込み条件を外す', kind: 'filter' },
  { id: 'scope', label: 'スコープを広げる', kind: 'space' },
  { id: 'external', label: 'それでも見つからないとき', kind: 'external' },
] as const satisfies readonly { id: PanelSuggestionGroup; label: string; kind: RowKind }[];

export function PanelSurface({
  sections,
  filters,
  onFilterChange,
  onFilterClear,
  spaces,
  statusSummary,
  tabs,
  selectedTab,
  onSelectTab,
  value,
  defaultValue,
  placeholder = '課題・Wiki・ドキュメントを検索',
  onValueChange,
  selectedId,
  preview,
  previewPlaceholder = '行を選ぶと、ここに内容が出ます',
  emptyState,
  onSuggestion,
  toast,
  footer = DEFAULT_FOOTER,
  footerNote = 'Backlog Palette',
  onAction,
  submitOnEnter = false,
  onSubmit,
  onEscape,
  autoFocus = false,
}: PanelSurfaceProps) {
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const listRootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const layout = usePanelLayout(root);

  const isEmpty = sections.every((section) => section.rows.length === 0);
  const showEmpty = isEmpty && emptyState !== undefined;
  const showTabs = tabs !== undefined && tabs.length > 0 && layout === 'wide';

  /*
   * キー処理は入力欄を包む要素にだけ付ける。サーフェス全体に付けると
   * フィルターバーや再接続ボタンの上で押した Enter まで候補の実行に化ける。
   */
  const guardComposition = createSurfaceKeyHandler({
    getInput: () => inputRef.current,
    getListRoot: () => listRootRef.current,
    onAction: showEmpty ? onSuggestion : onAction,
    onEscape,
  });

  /*
   * 入力を変えた直後の Enter は検索の実行に使う。行の実行に回すと、条件を
   * 打ち直しても前の結果のまま開いてしまう。結果がまだ 1 件も無いときは
   * 行の解決が失敗して何も起きないので、行より先にここで受ける。
   */
  const handleKeys = (event: KeyboardEvent<HTMLDivElement>) => {
    if (
      event.key === 'Enter' &&
      submitOnEnter &&
      onSubmit !== undefined &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      event.stopPropagation();
      onSubmit(inputRef.current?.value ?? '');
      return;
    }

    guardComposition(event);
  };

  const suggestionGroups = SUGGESTION_GROUPS.map((group) => ({
    ...group,
    items: (emptyState?.suggestions ?? []).filter((item) => item.group === group.id),
  })).filter((group) => group.items.length > 0);

  const leadSuggestionId = suggestionGroups[0]?.items[0]?.id;

  const results = (
    <ListBox
      className={styles.list}
      aria-label="検索結果"
      onAction={(key) => onAction?.(String(key))}
    >
      {sections.map((section) => (
        <ListBoxSection key={section.id} className={styles.section}>
          {section.label && !showTabs ? (
            <Header className={styles.sectionHeader}>
              <span className={styles.sectionLabel}>{section.label}</span>
              {section.meta ? <span className={styles.sectionMeta}>{section.meta}</span> : null}
            </Header>
          ) : null}
          {section.rows.map(({ id, ...row }) => (
            <ListBoxItem key={id} id={id} textValue={row.title} className={styles.item}>
              {({ isFocused }) => (
                <>
                  <Row
                    {...row}
                    selected={isFocused || id === selectedId || row.selected === true}
                  />
                  {layout === 'narrow' && id === selectedId && preview ? (
                    <Preview {...preview} variant="inline" />
                  ) : null}
                </>
              )}
            </ListBoxItem>
          ))}
        </ListBoxSection>
      ))}
    </ListBox>
  );

  const empty = emptyState ? (
    <div className={styles.empty}>
      <p className={styles.emptyTitle}>{emptyState.title ?? '一致する結果がありません'}</p>
      {emptyState.description ? (
        <p className={styles.emptyDescription}>{emptyState.description}</p>
      ) : null}

      <ListBox
        className={styles.list}
        aria-label="次にできること"
        onAction={(key) => onSuggestion?.(String(key))}
      >
        {suggestionGroups.map((group) => (
          <ListBoxSection key={group.id} className={styles.section}>
            <Header className={styles.sectionHeader}>
              <span className={styles.sectionLabel}>{group.label}</span>
            </Header>
            {group.items.map((item) => (
              <ListBoxItem
                key={item.id}
                id={item.id}
                textValue={item.label}
                className={styles.item}
              >
                {({ isFocused }) => (
                  <Row
                    kind={group.kind}
                    title={item.label}
                    sub={item.sub}
                    hint="enter"
                    tone={item.id === leadSuggestionId ? 'accent' : 'default'}
                    selected={isFocused}
                  />
                )}
              </ListBoxItem>
            ))}
          </ListBoxSection>
        ))}
      </ListBox>
    </div>
  ) : null;

  const main = showEmpty ? empty : results;

  return (
    <div ref={setRoot} className={styles.surface} data-bp-theme="" data-layout={layout}>
      <Autocomplete
        inputValue={value}
        defaultInputValue={defaultValue}
        onInputChange={onValueChange}
      >
        <div className={styles.search} onKeyDownCapture={handleKeys}>
          <Search size={16} strokeWidth={1.75} className={styles.searchIcon} aria-hidden />
          <TextField aria-label="サイドパネルの検索" className={styles.field}>
            <Input
              ref={inputRef}
              className={styles.input}
              placeholder={placeholder}
              autoFocus={autoFocus}
            />
          </TextField>
        </div>

        {filters ? (
          <FilterBar
            fields={filters}
            compact={layout === 'narrow'}
            portalContainer={root ?? undefined}
            onChange={onFilterChange}
            onClear={onFilterClear}
          />
        ) : null}

        {spaces ? <StatusStrip spaces={spaces} summary={statusSummary} /> : null}

        <div className={styles.body}>
          <div ref={listRootRef} className={styles.main}>
            {showTabs && tabs ? (
              <TypeTabs
                tabs={tabs}
                selected={selectedTab ?? tabs[0].id}
                onSelect={(id) => onSelectTab?.(id)}
              >
                {main}
              </TypeTabs>
            ) : (
              main
            )}
          </div>

          {layout === 'narrow' ? null : (
            <div className={styles.pane}>
              {preview ? (
                <Preview {...preview} />
              ) : (
                <p className={styles.paneEmpty}>{previewPlaceholder}</p>
              )}
            </div>
          )}
        </div>
      </Autocomplete>

      {/*
       * トーストは role="status" の 1 行で足りる。RAC の Toast は UNSTABLE_ のままで、
       * 表示のきっかけと寿命は呼び出し側が持つので、キューを持ち込む理由がない。
       */}
      {toast ? (
        <div className={styles.toast} role="status">
          <Check size={14} strokeWidth={2} className={styles.toastIcon} aria-hidden />
          <span className={styles.toastMessage}>{toast.message}</span>
          {toast.detail ? <span className={styles.toastDetail}>{toast.detail}</span> : null}
        </div>
      ) : null}

      <div className={styles.footer}>
        {footer.map((hint) => (
          <span key={hint.label} className={styles.footerHint}>
            <Kbd keys={hint.keys} />
            {hint.label}
          </span>
        ))}
        <span className={styles.footerSpacer} />
        <span className={styles.footerNote}>{footerNote}</span>
      </div>
    </div>
  );
}
