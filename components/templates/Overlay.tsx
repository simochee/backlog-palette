import type { ReactNode } from 'react';

type OverlayProps = {
  children: ReactNode;
  onDismiss?: () => void;
};

/**
 * 暗転 + 上寄せ中央配置。位置指定の祖先いっぱいに広がる（拡張ページでは body、
 * Storybook では story のラッパー）。外側のクリックだけを onDismiss で通知する。
 */
export function Overlay({ children, onDismiss }: OverlayProps) {
  return (
    <div
      data-testid="overlay"
      className="absolute inset-0 flex flex-col items-center bg-overlay px-4 pt-(--bp-offset-palette)"
      onClick={(event) => {
        if (event.target === event.currentTarget) onDismiss?.();
      }}
    >
      {children}
    </div>
  );
}
