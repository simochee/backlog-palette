import { settings } from '@/lib/storage/palette-items';
import { telemetry } from '@/lib/storage/telemetry-items';

import { record, type TelemetryEvent } from './aggregate';

/*
 * 読み書きを 1 本に並べる。連続したイベントで load → save が重なると片方が消える。
 * 設定は毎回読む。トグルを切った直後のイベントまで数えないため
 */
let queue: Promise<unknown> = Promise.resolve();

async function persist(event: TelemetryEvent, now: number): Promise<void> {
  const prefs = await settings.getValue();
  if (!prefs.telemetry) return;
  const store = await telemetry.getValue();
  await telemetry.setValue(record(store, event, now));
}

/** 「利用状況の送信」がオフなら何も記録しない。失敗しても呼び出し側を止めない */
export function track(event: TelemetryEvent, now: number = Date.now()): void {
  queue = queue.then(() => persist(event, now)).catch(() => null);
}
