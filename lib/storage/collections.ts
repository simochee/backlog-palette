import {
  activityCollection,
  queryDictCollection,
  searchHistoryCollection,
  spacesCollection,
  transitionsCollection,
} from './definitions';
import { activity, queryDict, searchHistory, spaces, transitions } from './palette-items';

/**
 * 既定の item を配線したコレクション。表示キャッシュは M3 の items.ts の displayCache を
 * displayCacheCollection に渡して作る（container が配線する）。鍵（apiKeys）と設定はコレクションに
 * しない: live query の対象にすると UI のどこからでも購読できてしまう（tech-stack §3.2）
 */
export const collections = {
  activity: () => activityCollection(activity),
  transitions: () => transitionsCollection(transitions),
  searchHistory: () => searchHistoryCollection(searchHistory),
  queryDict: () => queryDictCollection(queryDict),
  spaces: () => spacesCollection(spaces),
};
