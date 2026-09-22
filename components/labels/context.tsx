import { createContext, type ReactNode, use } from 'react';

import { ja } from './ja';
import type { Labels } from './types';

const LabelsContext = createContext<Labels>(ja);

export function LabelsProvider({ labels, children }: { labels: Labels; children: ReactNode }) {
  return <LabelsContext value={labels}>{children}</LabelsContext>;
}

/**
 * 既定は ja。Storybook の locale toolbar は Provider で差し替え、個々の部品は
 * `labels` prop で部分的に上書きできる。
 */
export function useLabels(override?: Partial<Labels>): Labels {
  const base = use(LabelsContext);
  return override ? { ...base, ...override } : base;
}
