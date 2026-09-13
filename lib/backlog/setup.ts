import { clientFor } from './clients';
import { persistToStorage } from './persister';
import { type BacklogQueries, createBacklogQueries } from './queries';
import { createBacklogQueryClient } from './queryClient';
import { createSearchQueries, type SearchQueries } from './search';
import { createSearchRunner, type SearchRunner } from './searchRunner';

export type BacklogQuerySetup = {
  queryClient: ReturnType<typeof createBacklogQueryClient>;
  queries: BacklogQueries;
  search: SearchQueries;
  /** パレットの検索行の ↵ が呼ぶ。1 スペースの中で種別を並列（D-20） */
  runner: SearchRunner;
  /** storage からの復元が済むまで */
  restored: Promise<void>;
};

/** 拡張ページごとに 1 つ作る。QueryClientProvider に queryClient を渡し、queries を useQuery に渡す */
export function setupBacklogQueries(): BacklogQuerySetup {
  const queryClient = createBacklogQueryClient();
  const { restored } = persistToStorage(queryClient);
  const queries = createBacklogQueries(clientFor, queryClient);
  const search = createSearchQueries(clientFor, queryClient, queries);
  return { queryClient, queries, search, runner: createSearchRunner(queryClient, search), restored };
}
