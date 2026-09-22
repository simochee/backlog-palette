import { useRef, useState } from 'react';

import type { FocusHandle } from '@/components/types';

import { useHandoff } from './handoff.ts';
import { useToast } from './hooks.ts';
import { rememberSearch } from './lastSearch.ts';
import { rootRoute } from './route.ts';
import type { PanelSearch } from './searchParams.ts';

/** 入力・選択・トースト・URL の更新。開いている間の受け渡しは入力と URL の両方に写す */
export function usePanelState(search: PanelSearch) {
  const navigate = rootRoute.useNavigate();
  const [input, setInput] = useState(search.query);
  const [selectedId, setSelectedId] = useState<string>();
  const [toast, showToast] = useToast();
  const panelRef = useRef<FocusHandle>(null);
  const update = (next: PanelSearch) => {
    rememberSearch(next);
    void navigate({ to: '/', search: next });
  };
  useHandoff((next) => {
    setInput(next.query);
    update(next);
    panelRef.current?.focus();
  });
  return { input, setInput, selectedId, setSelectedId, toast, showToast, update, panelRef };
}
