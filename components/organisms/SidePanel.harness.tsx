import { useState } from 'react';

import { SidePanel, type SidePanelProps } from './SidePanel';

/** story 用。container の代わりに入力値と選択行を保持する（Palette.harness と同じ役割） */
export function StatefulSidePanel(props: SidePanelProps) {
  const [value, setValue] = useState(props.input.value);
  const [selectedId, setSelectedId] = useState(props.selectedId);

  return (
    <SidePanel
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
