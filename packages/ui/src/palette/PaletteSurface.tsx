import { type KeyboardEvent, type ReactNode, useRef } from 'react';
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

  /**
   * 変換中のキーはリストに届かせない。
   *
   * React Aria は isComposing を見ないため、これが無いと変換確定の Enter で
   * 遷移が発火し、↑↓ での IME 候補選択がリストの選択移動と二重に動く（P4）。
   * キャプチャ段階で止めるので、Autocomplete の内部ハンドラより先に効く。
   */
  const guardComposition = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.nativeEvent.isComposing) {
      event.stopPropagation();
      return;
    }

    /*
     * Enter の宛先は自分で決める。
     *
     * React Aria は候補が入れ替わっても仮想フォーカスを持ち越すため、
     * aria-activedescendant が消えた行を指したまま残ることがある
     * （`PROJ-12` まで打った時点の行を、`PROJ-123` の候補が出た後も指す）。
     * その状態で Enter を押すと宛先が存在せず、何も起きない。行は selected の
     * 見た目なので、いちばん分かりにくい壊れ方になる。
     *
     * 実在するフォーカス行、無ければ先頭行、という規則にすれば
     * 「見えている選択と Enter の宛先は必ず一致する」を保証できる。
     */
    if (event.key === 'Enter' && onAction) {
      const list = event.currentTarget.querySelector('[role="listbox"]');
      const focused = list?.querySelector('[role="option"][data-focused]');
      const target = focused ?? list?.querySelector('[role="option"]');
      const key = target?.getAttribute('data-key');

      if (key !== null && key !== undefined) {
        event.preventDefault();
        event.stopPropagation();
        onAction(key);
        return;
      }
    }

    /*
     * Esc は React Aria が入力欄のクリアに使うため、先に奪う。
     * 「Esc で 1 階層戻る / 閉じる」は覚えるキーを増やさないための規則
     * （§3 D3）で、入力欄のクリアに消費されると階層から出られなくなる。
     */
    if (event.key === 'Escape' && onEscape) {
      event.preventDefault();
      event.stopPropagation();
      onEscape();
      return;
    }

    if (event.key === 'Backspace' && onStackBackspace) {
      const input = inputRef.current;
      const atStart = input?.selectionStart === 0 && input?.selectionEnd === 0;
      if (atStart) {
        event.preventDefault();
        event.stopPropagation();
        onStackBackspace();
      }
    }
  };

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
