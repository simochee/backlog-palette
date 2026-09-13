import { storage } from '#imports';
import { EMPTY_TELEMETRY, type TelemetryStore } from '@/lib/telemetry/aggregate';

/** 利用状況のローカル集計（surfaces.md §10）。送信先が決まるまではここに置くだけ */
export const telemetry = storage.defineItem<TelemetryStore>('local:telemetry', {
  fallback: EMPTY_TELEMETRY,
  version: 1,
});
