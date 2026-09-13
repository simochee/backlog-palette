import { createStore, type Store } from '@tanstack/store';

import { reduce } from './reduce';
import { initialState, type PaletteAction, type PaletteState } from './state';

export type PaletteStore = Store<PaletteState> & { dispatch: (action: PaletteAction) => void };

/** Store は @tanstack/store。遷移は reduce に閉じ、Store は状態を持って通知するだけ */
export function createPaletteStore(state: PaletteState = initialState): PaletteStore {
  const store = createStore(state);
  const dispatch = (action: PaletteAction): void => {
    store.setState((previous) => reduce(previous, action));
  };
  return Object.assign(store, { dispatch });
}
