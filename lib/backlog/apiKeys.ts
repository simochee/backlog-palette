import { apiKeys } from '@/lib/storage/items';

/** 鍵の読み書きはこのモジュールだけが行う。呼ぶのは拡張ページと Service Worker（I7） */
export async function readApiKey(spaceHost: string): Promise<string | undefined> {
  return (await apiKeys.getValue())[spaceHost];
}

export async function saveApiKey(spaceHost: string, apiKey: string): Promise<void> {
  const all = await apiKeys.getValue();
  await apiKeys.setValue({ ...all, [spaceHost]: apiKey });
}

export async function removeApiKey(spaceHost: string): Promise<void> {
  const { [spaceHost]: _removed, ...rest } = await apiKeys.getValue();
  await apiKeys.setValue(rest);
}

/** 鍵の出入りを知らせる。鍵そのものは渡さない */
export function watchConnectedSpaceHosts(onChange: () => void): () => void {
  return apiKeys.watch(() => onChange());
}

/** 鍵を持っているホストの一覧。鍵そのものは返さない */
export async function connectedSpaceHosts(): Promise<string[]> {
  return Object.keys(await apiKeys.getValue());
}
