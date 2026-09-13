import { clientFor } from './clients';
import { persistToStorage } from './persister';
import { type BacklogQueries, createBacklogQueries } from './queries';
import { createBacklogQueryClient } from './queryClient';

export type BacklogQuerySetup = {
  queryClient: ReturnType<typeof createBacklogQueryClient>;
  queries: BacklogQueries;
  /** storage からの復元が済むまで */
  restored: Promise<void>;
};

/** 拡張ページごとに 1 つ作る。QueryClientProvider に queryClient を渡し、queries を useQuery に渡す */
export function setupBacklogQueries(): BacklogQuerySetup {
  const queryClient = createBacklogQueryClient();
  const { restored } = persistToStorage(queryClient);
  return { queryClient, queries: createBacklogQueries(clientFor, queryClient), restored };
}
