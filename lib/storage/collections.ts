import {
  activityCollection,
  queryDictCollection,
  searchHistoryCollection,
  transitionsCollection,
} from './definitions';
import { activity, queryDict, searchHistory, transitions } from './palette-items';

/**
 * 既定の item を配線したコレクション。表示キャッシュ（displayCache）とスペース（spaces）の item は
 * M3 / M4 の items.ts が所有するので、displayCacheCollection / spacesCollection への配線は
 * container が行う。鍵（apiKeys）と設定はコレクションにしない: live query の対象にすると UI の
 * どこからでも購読できてしまう（tech-stack §3.2）
 */
export const collections = {
  activity: () => activityCollection(activity),
  transitions: () => transitionsCollection(transitions),
  searchHistory: () => searchHistoryCollection(searchHistory),
  queryDict: () => queryDictCollection(queryDict),
};
