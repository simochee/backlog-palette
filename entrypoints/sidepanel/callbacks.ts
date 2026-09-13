import type { Labels } from '@/components/labels';
import type { SidePanelCallbacks } from '@/components/organisms/SidePanel';
import type { ToastView } from '@/components/types';
import { apiKeyPageUrl } from '@/lib/connect/page';
import { resultRowId, type SearchSession } from '@/lib/search';
import { buildShareUrl, type SearchState } from '@/lib/share';
import { navigate as openUrl } from '@/lib/tabs';
import { track } from '@/lib/telemetry/track';

import { applyFilter, clearConditions } from './filters.ts';
import type { PanelSearch } from './searchParams.ts';
import { CLEAR_FILTERS_ROW_ID, needsReconnect } from './view.ts';

export type CallbackEnv = {
  search: PanelSearch;
  session: SearchSession | undefined;
  labels: Labels;
  update: (next: PanelSearch) => void;
  setInput: (value: string) => void;
  setSelectedId: (id: string) => void;
  showToast: (toast: ToastView) => void;
  currentState: () => SearchState | undefined;
};

/** 行はパレットと同じ動作（surfaces.md §5.4）。↵ で遷移、⌘↵ で新しいタブ。遷移してもパネルは閉じない */
export function panelCallbacks(env: CallbackEnv): SidePanelCallbacks {
  const { search, session, labels, update } = env;
  const rowOf = (id: string) => session?.rows.find((row) => resultRowId(row) === id);
  return {
    onInputChange: env.setInput,
    onSelectionChange: env.setSelectedId,
    onSearch: (query) => update({ ...search, query }),
    onFilterChange: (fieldId, optionId) => {
      track({ type: 'panelFilterChanged' });
      update(applyFilter(search, fieldId, optionId));
    },
    onClearFilters: () => update(clearConditions(search)),
    onAction: (id, { newTab }) => {
      if (id === CLEAR_FILTERS_ROW_ID) {
        update(clearConditions(search));
        return;
      }
      const row = rowOf(id);
      if (row !== undefined) void openUrl(row.url, newTab ? 'new' : 'current');
    },
    onTake: (id) => {
      const row = rowOf(id);
      if (row !== undefined) env.setInput(row.key ?? row.title);
    },
    onProgressAction: () => {
      if (needsReconnect(session) && search.scope !== undefined)
        void openUrl(apiKeyPageUrl(`https://${search.scope.spaceId}`), 'new');
    },
    onCopySearchUrl: () => {
      const state = env.currentState();
      if (state === undefined) return;
      // クリップボードは拡張ページで書く（palette.md §11）
      void navigator.clipboard
        .writeText(buildShareUrl(`https://${state.scope.spaceId}`, state))
        .then(() => env.showToast({ message: labels.rows.copied(labels.keys.copyUrl) }));
    },
  };
}
