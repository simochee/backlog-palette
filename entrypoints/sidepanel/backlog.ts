import { setupBacklogQueries } from '@/lib/backlog/setup';

/** サイドパネルに 1 つ。QueryClient は persister で他の拡張ページとキャッシュを共有する */
export const backlog = setupBacklogQueries();
