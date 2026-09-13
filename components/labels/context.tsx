import { createContext, type ReactNode, useContext, useMemo } from 'react';

import { ja } from './ja';
import type { Labels } from './types';

const LabelsContext = createContext<Labels>(ja);

export function LabelsProvider({ labels, children }: { labels: Labels; children: ReactNode }) {
  return <LabelsContext.Provider value={labels}>{children}</LabelsContext.Provider>;
}

/**
 * 既定は ja。Storybook の locale toolbar は Provider で差し替え、個々の部品は
 * `labels` prop で部分的に上書きできる。
 */
export function useLabels(override?: Partial<Labels>): Labels {
  const base = useContext(LabelsContext);
  return useMemo(() => (override ? { ...base, ...override } : base), [base, override]);
}
