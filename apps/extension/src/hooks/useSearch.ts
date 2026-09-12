import {
  emptyResultList,
  mergeChunk,
  promoteHeld,
  type ResultList,
  type SearchState,
} from '@backlog-palette/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { onEvent, type SearchResultRow, sendMessage } from '../messaging/ext.ts';

export type SpaceProgress = {
  spaceKey: string;
  state: 'loading' | 'ready' | 'error';
  count?: number;
  message?: string;
};

const ERROR_MESSAGE: Record<string, string> = {
  unauthorized: '認証が切れています',
  rateLimited: '混み合っています',
  offline: 'オフラインです',
  unknown: '取得できませんでした',
};

export type SearchSession = {
  results: ResultList<SearchResultRow>;
  spaces: readonly SpaceProgress[];
  running: boolean;
  start: (state: SearchState) => void;
  /** 選択が先頭に戻ったときに、保留していた結果を合流させる */
  promote: () => void;
  setSelectedIndex: (index: number) => void;
};

/**
 * 検索の状態。結果は届いた順に合流させる（実装プラン §7.4・§3 D6）。
 *
 * 選択位置を合流の判断に使うので、どの行を見ているかをここが知っている必要がある。
 */
export function useSearch(currentSpaceKey?: string): SearchSession {
  const [results, setResults] = useState<ResultList<SearchResultRow>>(emptyResultList);
  const [spaces, setSpaces] = useState<readonly SpaceProgress[]>([]);
  const [running, setRunning] = useState(false);
  const requestId = useRef<string>('');
  const selectedIndex = useRef(0);

  useEffect(() => {
    const stop = onEvent('searchChunk', ({ data }) => {
      // 打鍵し直した後に届いた前の検索の結果は捨てる
      if (data.requestId !== requestId.current) return;

      setSpaces((current) => {
        const rest = current.filter((space) => space.spaceKey !== data.spaceKey);
        if (data.state === 'loading') {
          return [...rest, { spaceKey: data.spaceKey, state: 'loading' }];
        }
        if (data.state === 'error') {
          return [
            ...rest,
            {
              spaceKey: data.spaceKey,
              state: 'error',
              message: ERROR_MESSAGE[data.error.kind] ?? ERROR_MESSAGE.unknown,
            },
          ];
        }
        return [...rest, { spaceKey: data.spaceKey, state: 'ready', count: data.total }];
      });

      if (data.state === 'done') {
        setResults((current) =>
          mergeChunk(current, data.rows, {
            selectedIndex: selectedIndex.current,
            ctx: currentSpaceKey === undefined ? {} : { currentSpaceKey },
          }),
        );
      }
    });

    return () => stop();
  }, [currentSpaceKey]);

  const start = useCallback((state: SearchState) => {
    const id = crypto.randomUUID();
    if (requestId.current !== '') {
      void sendMessage('cancelSearch', requestId.current).catch(() => undefined);
    }

    requestId.current = id;
    selectedIndex.current = 0;
    setResults(emptyResultList());
    setSpaces([]);
    setRunning(true);

    void sendMessage('startSearch', { requestId: id, state })
      .catch(() => undefined)
      .finally(() => setRunning(false));
  }, []);

  const promote = useCallback(() => {
    setResults((current) =>
      promoteHeld(current, currentSpaceKey === undefined ? {} : { currentSpaceKey }),
    );
  }, [currentSpaceKey]);

  return {
    results,
    spaces,
    running,
    start,
    promote,
    setSelectedIndex: (index) => {
      selectedIndex.current = index;
    },
  };
}
