import type { ReactNode } from 'react';

import { useHasMoreBelow } from '@/components/hooks/useHasMoreBelow';

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
  const [hasMoreBelow, listRef] = useHasMoreBelow();

  return (
    <div
      role="dialog"
      aria-label={aria['aria-label']}
      className="@container flex w-full max-w-(--bp-width-palette) flex-col overflow-hidden rounded-surface bg-floating font-body text-default shadow-floating"
      style={width === undefined ? undefined : { maxWidth: width }}
    >
      <div className="shrink-0 border-b border-border">{header}</div>
      {/* 上限の高さで切れた行は「途中で終わった」ようにしか見えない。下端にだけ地の色へ落とす */}
      <div className="relative min-h-(--bp-size-row)">
        <div ref={listRef} className="max-h-(--bp-height-list-max) overflow-y-auto">
          {list}
        </div>
        {hasMoreBelow && (
          <div
            aria-hidden
            data-testid="list-fade"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-5 bg-linear-to-t from-floating to-transparent"
          />
        )}
      </div>
      <div className="h-(--bp-size-footer) shrink-0 border-t border-border">{footer}</div>
    </div>
  );
}
