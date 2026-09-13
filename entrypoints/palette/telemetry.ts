import { track } from '@/lib/telemetry/track';

export type { TelemetryEvent } from '@/lib/telemetry/aggregate';

/**
 * 1 回の起動の中で数えるもの。打鍵数は遷移が完了したときにだけ送り、
 * 語そのものは持たない（surfaces.md §10）
 */
let keystrokes = 0;

export const paletteTelemetry = {
  opened() {
    keystrokes = 0;
    track({ type: 'paletteOpened' });
  },
  typed() {
    keystrokes += 1;
  },
  navigated(fromEmptyState: boolean) {
    track({ type: 'paletteNavigated', keystrokes, fromEmptyState });
  },
};

export { track };
