import type { KeyboardEvent } from 'react';

import { flattenRows } from '@/components/organisms/CandidateList';
import { dispatchKeyDecision, resolveKeyFor } from '@/components/organisms/Palette.handler';

import type { SidePanelProps } from './SidePanel';

/**
 * パネル固有のキー（surfaces.md §5.4）を先に見て、残りは Palette と同じ規則に流す。
 * 入力欄が空で行も無いときの ↑ は直前の検索語の再入力、行が無いときの Enter は検索の起動。
 */
export function usePanelKeyHandler(props: SidePanelProps, listId: string) {
  return (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    const rows = flattenRows(props.sections);
    const value = event.currentTarget.value;
    const previous = props.recentQueries[0];

    if (event.key === 'ArrowUp' && value === '' && rows.length === 0 && previous !== undefined) {
      event.preventDefault();
      props.onInputChange(previous);
      return;
    }
    if (event.key === 'Enter' && rows.length === 0 && !event.metaKey && !event.ctrlKey) {
      event.preventDefault();
      props.onSearch(value);
      return;
    }
    dispatchKeyDecision(resolveKeyFor(event, props, listId), event, props);
  };
}
