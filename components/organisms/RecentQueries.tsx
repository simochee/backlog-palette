import { type Labels, useLabels } from '@/components/labels';

type RecentQueriesProps = {
  queries: readonly string[];
  onPick: (query: string) => void;
  labels?: Partial<Labels>;
};

export function RecentQueries({ queries, onPick, ...rest }: RecentQueriesProps) {
  const labels = useLabels(rest.labels);
  if (queries.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-sm">
      <span className="text-subtle">{labels.panel.recent}:</span>
      {queries.map((query) => (
        <button
          key={query}
          type="button"
          onClick={() => onPick(query)}
          className="max-w-48 truncate rounded-pill bg-sunken px-2 py-0.5 text-default outline-none hover:bg-row-selected focus-visible:ring-2 focus-visible:ring-ring"
        >
          {query}
        </button>
      ))}
    </div>
  );
}
