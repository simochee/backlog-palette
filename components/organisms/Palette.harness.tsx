import { useState } from 'react';

import { Palette, type PaletteProps } from './Palette';

/**
 * story 用。container の代わりに入力値と選択行を保持し、Palette を controlled のまま動かす。
 * コールバックは保持した後に story のスパイへ転送するので、検査は結果（呼ばれたか）で行える。
 */
export function StatefulPalette(props: PaletteProps) {
  const [value, setValue] = useState(props.input.value);
  const [selectedId, setSelectedId] = useState(props.selectedId);

  return (
    <Palette
      {...props}
      input={{ ...props.input, value }}
      selectedId={selectedId}
      onInputChange={(next) => {
        setValue(next);
        props.onInputChange(next);
      }}
      onSelectionChange={(id) => {
        setSelectedId(id);
        props.onSelectionChange(id);
      }}
    />
  );
}
