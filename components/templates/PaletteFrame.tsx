import type { ReactNode } from 'react';

type PaletteFrameProps = {
  header: ReactNode;
  list: ReactNode;
  footer: ReactNode;
  width?: number;
  'aria-label': string;
};

/**
 * ヘッダー／リスト／フッターの配置と高さの規則（palette.md §1）。データを持たない。
 * 幅は min(--bp-width-palette, 親の幅) で、親の左右余白は Overlay が持つ。
 */
export function PaletteFrame({ header, list, footer, width, ...aria }: PaletteFrameProps) {
  return (
    <div
      role="dialog"
      aria-label={aria['aria-label']}
      className="@container flex w-full max-w-(--bp-width-palette) flex-col overflow-hidden rounded-surface bg-floating font-body text-default shadow-floating"
      style={width === undefined ? undefined : { maxWidth: width }}
    >
      <div className="shrink-0 border-b border-border">{header}</div>
      <div className="min-h-(--bp-size-row) max-h-(--bp-height-list-max) overflow-y-auto">{list}</div>
      <div className="h-(--bp-size-footer) shrink-0 border-t border-border">{footer}</div>
    </div>
  );
}
