import { type ReactNode, useRef } from 'react';
import {
  Autocomplete,
  Header,
  Input,
  ListBox,
  ListBoxItem,
  ListBoxSection,
  TextField,
} from 'react-aria-components';
import { Kbd } from '../primitives/Kbd.tsx';
import styles from './PaletteSurface.module.css';
import { type PathSegment, PathStack } from './PathStack.tsx';
import { Row, type RowProps } from './Row.tsx';
import { createSurfaceKeyHandler } from './surfaceKeys.ts';

export type PaletteRow = RowProps & { id: string };

export type PaletteSection = {
  id: string;
  label?: string;
  meta?: string;
  rows: readonly PaletteRow[];
};

export type FooterHint = { keys: readonly string[]; label: string };

export type PaletteSurfaceProps = {
  path: readonly PathSegment[];
  sections: readonly PaletteSection[];
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  /** Tab で補完できる残り。入力の後ろにゴーストとして出す */
  completion?: string;
  /** ⌫ の 1 回目で出す予告 */
  armedNotice?: boolean;
  footer?: readonly FooterHint[];
  footerNote?: string;
  /** 結果リストの代わりに出す内容（0 件時の説明など） */
  banner?: ReactNode;
  width?: number;
  onValueChange?: (value: string) => void;
  onAction?: (id: string) => void;
  /** キャレットが先頭にあるときの ⌫。スタックの armed / pop に使う */
  onStackBackspace?: () => void;
  /** Esc。1 階層戻すか閉じるかは呼び出し側が決める */
  onEscape?: () => void;
  /** 表示と同時に入力欄へフォーカスする */
  autoFocus?: boolean;
};

const DEFAULT_FOOTER: readonly FooterHint[] = [
  { keys: ['↑', '↓'], label: '移動' },
  { keys: ['↵'], label: '開く' },
  { keys: ['⇥'], label: '候補を補完' },
  { keys: ['⌫'], label: '右端から 1 段戻す' },
];

export function PaletteSurface({
  path,
  sections,
  value,
  defaultValue,
  placeholder = 'ページ・課題キー・コマンドを入力',
  completion,
  armedNotice = false,
  footer = DEFAULT_FOOTER,
  footerNote = 'Backlog Palette',
  banner,
  width,
  onValueChange,
  onAction,
  onStackBackspace,
  onEscape,
  autoFocus = false,
}: PaletteSurfaceProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const shown = value ?? defaultValue ?? '';

  const guardComposition = createSurfaceKeyHandler({
    getInput: () => inputRef.current,
    onAction,
    onEscape,
    onStackBackspace,
  });

  return (
    <div
      className={styles.surface}
      data-bp-theme=""
      style={width === undefined ? undefined : { width }}
      onKeyDownCapture={guardComposition}
    >
      <Autocomplete
        inputValue={value}
        defaultInputValue={defaultValue}
        onInputChange={onValueChange}
      >
        <div className={styles.header}>
          <PathStack segments={path} />

          <TextField aria-label="パレットの入力" className={styles.field}>
            <div className={styles.inputWrap}>
              <Input
                ref={inputRef}
                className={styles.input}
                placeholder={placeholder}
                autoFocus={autoFocus}
              />
              {completion ? (
                <span className={styles.ghost} aria-hidden>
                  <span className={styles.ghostTyped}>{shown}</span>
                  <span className={styles.ghostRest}>{completion}</span>
                  <span className={styles.ghostChip}>⇥ で補完</span>
                </span>
              ) : null}
            </div>
          </TextField>

          {armedNotice ? <span className={styles.armedNotice}>もう一度 ⌫ で右端を削除</span> : null}

          <span className={styles.escHint}>
            <Kbd keys={['esc']} />
            閉じる
          </span>
        </div>

        {banner}

        <ListBox
          className={styles.list}
          aria-label="候補"
          onAction={(key) => onAction?.(String(key))}
        >
          {sections.map((section) => (
            <ListBoxSection key={section.id} className={styles.section}>
              {section.label ? (
                <Header className={styles.sectionHeader}>
                  <span className={styles.sectionLabel}>{section.label}</span>
                  {section.meta ? <span className={styles.sectionMeta}>{section.meta}</span> : null}
                </Header>
              ) : null}
              {section.rows.map(({ id, ...row }) => (
                <ListBoxItem key={id} id={id} textValue={row.title} className={styles.item}>
                  {({ isFocused }) => (
                    <Row {...row} selected={isFocused || row.selected === true} />
                  )}
                </ListBoxItem>
              ))}
            </ListBoxSection>
          ))}
        </ListBox>
      </Autocomplete>

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
