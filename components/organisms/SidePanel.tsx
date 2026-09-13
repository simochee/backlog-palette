import { Search } from 'lucide-react';
import { type KeyboardEvent, type RefObject, useEffect, useId, useRef } from 'react';

import { type Labels, useLabels } from '@/components/labels';
import { PaletteInput } from '@/components/molecules/PaletteInput';
import { CandidateList, optionDomId } from '@/components/organisms/CandidateList';
import { FilterBar } from '@/components/organisms/FilterBar';
import { PaletteFooter } from '@/components/organisms/PaletteFooter';
import { RecentQueries } from '@/components/organisms/RecentQueries';
import { StatusStrip } from '@/components/organisms/StatusStrip';
import { PanelLayout } from '@/components/templates/PanelLayout';
import type { PanelView } from '@/components/types';

import { usePanelKeyHandler } from './SidePanel.handler';

export type SidePanelCallbacks = {
  onInputChange: (value: string) => void;
  onSelectionChange: (id: string) => void;
  onAction: (id: string, opts: { newTab: boolean }) => void;
  onTake: (id: string) => void;
  onSearch: (query: string) => void;
  onFilterChange: (fieldId: string, optionId: string) => void;
  onClearFilters: () => void;
  onProgressAction: (id: string) => void;
  onCopySearchUrl?: () => void;
  onEscape?: () => void;
};

export type SidePanelProps = PanelView &
  SidePanelCallbacks & {
    labels?: Partial<Labels>;
    compact?: boolean;
  };

function SearchField({
  props,
  listId,
  inputRef,
  onKeyDown,
  inputLabel,
}: {
  props: SidePanelProps;
  listId: string;
  inputRef: RefObject<HTMLInputElement | null>;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  inputLabel: string;
}) {
  return (
    <div className="flex h-(--bp-size-control) items-center gap-2 rounded-control border border-border-strong bg-control px-2 focus-within:ring-2 focus-within:ring-ring">
      <Search aria-hidden className="size-(--bp-size-icon) shrink-0 text-subtle" />
      <PaletteInput
        ref={inputRef}
        value={props.input.value}
        placeholder={props.input.placeholder}
        onChange={props.onInputChange}
        onKeyDown={onKeyDown}
        aria-label={inputLabel}
        aria-controls={listId}
        aria-activedescendant={
          props.selectedId === undefined ? undefined : optionDomId(listId, props.selectedId)
        }
      />
    </div>
  );
}

function PanelFilters({ props }: { props: SidePanelProps }) {
  return (
    <>
      <FilterBar
        fields={props.filters}
        onChange={props.onFilterChange}
        onClearAll={props.onClearFilters}
        compact={props.compact}
        labels={props.labels}
      />
      <StatusStrip
        progress={props.progress}
        onProgressAction={props.onProgressAction}
        labels={props.labels}
      />
    </>
  );
}

export function SidePanel(props: SidePanelProps) {
  const labels = useLabels(props.labels);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = `${useId()}list`;
  const handleKeyDown = usePanelKeyHandler(props, listId);
  const { selectedId } = props;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const pickRecent = (query: string) => {
    props.onInputChange(query);
    props.onSearch(query);
  };

  return (
    <PanelLayout
      aria-label={labels.panel.title}
      input={
        <SearchField
          props={props}
          listId={listId}
          inputRef={inputRef}
          onKeyDown={handleKeyDown}
          inputLabel={labels.panel.inputLabel}
        />
      }
      recent={
        props.input.value === '' ? (
          <RecentQueries queries={props.recentQueries} onPick={pickRecent} labels={props.labels} />
        ) : undefined
      }
      filters={<PanelFilters props={props} />}
      list={
        <CandidateList
          id={listId}
          sections={props.sections}
          selectedId={selectedId}
          onAction={(id) => props.onAction(id, { newTab: false })}
          aria-label={labels.palette.listLabel}
        />
      }
      footer={<PaletteFooter hints={props.footer} toast={props.toast} brand={labels.brand} />}
    />
  );
}
