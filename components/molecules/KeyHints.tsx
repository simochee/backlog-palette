import { useLayoutEffect, useRef, useState } from 'react';

import { Kbd } from '@/components/atoms/Kbd';
import { useElementWidth } from '@/components/hooks/useElementWidth';
import type { KeyHint } from '@/components/types';

type KeyHintsProps = {
  hints: readonly KeyHint[];
};

/**
 * 幅に収まる分だけを残す。priority の大きいものから落とし、priority 0（↵）は必ず残す。
 * 表示中の要素は落ちた後に測れないので、測定用の複製を不可視で常に描いておく。
 */
export function fitHints(
  hints: readonly KeyHint[],
  widths: ReadonlyMap<string, number>,
  available: number,
  gap: number,
): KeyHint[] {
  const byPriority = hints.toSorted((a, b) => a.priority - b.priority);
  const kept = new Set<string>();
  let used = 0;
  for (const hint of byPriority) {
    const width = widths.get(hint.id) ?? 0;
    const next = used + width + (kept.size > 0 ? gap : 0);
    if (next <= available || hint.priority === 0) {
      kept.add(hint.id);
      used = next;
    }
  }
  return hints.filter((hint) => kept.has(hint.id));
}

function HintItem({ hint }: { hint: KeyHint }) {
  return (
    <span
      data-hint-id={hint.id}
      className="flex shrink-0 items-center gap-1 text-xs whitespace-nowrap text-subtle"
    >
      <Kbd keys={hint.keys} />
      <span>{hint.label}</span>
    </span>
  );
}

export function KeyHints({ hints }: KeyHintsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const available = useElementWidth(containerRef);
  const [visible, setVisible] = useState<readonly KeyHint[]>(hints);

  useLayoutEffect(() => {
    const measure = measureRef.current;
    if (measure === null || available === undefined) return;

    const items = Array.from(measure.querySelectorAll<HTMLElement>('[data-hint-id]'));
    const widths = new Map<string, number>();
    for (const item of items) {
      const id = item.dataset.hintId;
      if (id !== undefined) widths.set(id, item.getBoundingClientRect().width);
    }
    const [first, second] = items;
    const gap =
      first !== undefined && second !== undefined
        ? second.getBoundingClientRect().left - first.getBoundingClientRect().right
        : 0;
    setVisible(fitHints(hints, widths, available, gap));
  }, [hints, available]);

  return (
    <div
      ref={containerRef}
      className="relative flex min-w-0 flex-1 items-center gap-3 overflow-hidden"
    >
      {visible.map((hint) => (
        <HintItem key={hint.id} hint={hint} />
      ))}
      <div
        ref={measureRef}
        aria-hidden
        className="pointer-events-none invisible absolute top-0 left-0 flex items-center gap-3 whitespace-nowrap"
      >
        {hints.map((hint) => (
          <HintItem key={hint.id} hint={hint} />
        ))}
      </div>
    </div>
  );
}
