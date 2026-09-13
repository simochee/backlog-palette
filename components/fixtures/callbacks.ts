import { fn } from 'storybook/test';

/** story の args に渡すスパイ。名前つき export を story と誤認されないよう stories ファイルの外に置く */
export const paletteCallbacks = () => ({
  onInputChange: fn(),
  onSelectionChange: fn(),
  onAction: fn(),
  onTake: fn(),
  onBackspaceAtStart: fn(),
  onEscape: fn(),
  onCopySearchUrl: fn(),
  onOpenPanel: fn(),
  onDismiss: fn(),
});

export const panelCallbacks = () => ({
  onInputChange: fn(),
  onSelectionChange: fn(),
  onAction: fn(),
  onTake: fn(),
  onSearch: fn(),
  onFilterChange: fn(),
  onClearFilters: fn(),
  onProgressAction: fn(),
  onCopySearchUrl: fn(),
  onEscape: fn(),
});
