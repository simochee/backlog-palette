import { type RefObject, useLayoutEffect, useRef, useState } from 'react';

import { Kbd } from '@/components/atoms/Kbd';
import { useElementWidth } from '@/components/hooks/useElementWidth';
import type { KeyHint } from '@/components/types';

type KeyHintsProps = {
  hints: readonly KeyHint[];
};

/**
 * 幅に収まる分だけを残す。優先順の右側から落とし、priority 0（↵）は必ず残す（palette.md §6）。
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
    // 入らなくなったら以降を全部落とす。詰められるものを探しに行くと、ラベルの短い下位の
    // ヒントが上位を追い越して残り、幅と言語で「どのキーが見えるか」が変わる（P5・P6）
    if (next > available && hint.priority !== 0) break;
    kept.add(hint.id);
    used = next;
  }
  return hints.filter((hint) => kept.has(hint.id));
}

function HintItem({ hint, short }: { hint: KeyHint; short: boolean }) {
  return (
    <span
      data-hint-id={hint.id}
      className="flex shrink-0 items-center gap-1 text-xs whitespace-nowrap text-subtle"
    >
      <Kbd keys={hint.keys} />
      <span>{(short ? hint.shortLabel : undefined) ?? hint.label}</span>
    </span>
  );
}

/** 幅の測定用に不可視で描く列。表示中の要素は落ちた後に測れない */
function Measure({
  innerRef,
  hints,
  short,
}: {
  innerRef: RefObject<HTMLDivElement | null>;
  hints: readonly KeyHint[];
  short: boolean;
}) {
  return (
    <div
      ref={innerRef}
      aria-hidden
      className="pointer-events-none invisible absolute top-0 left-0 flex items-center gap-3 whitespace-nowrap"
    >
      {hints.map((hint) => (
        <HintItem key={hint.id} hint={hint} short={short} />
      ))}
    </div>
  );
}

function measured(container: HTMLDivElement): { widths: Map<string, number>; gap: number } {
  const items = Array.from(container.querySelectorAll<HTMLElement>('[data-hint-id]'));
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
  return { widths, gap };
}

export function KeyHints({ hints }: KeyHintsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fullRef = useRef<HTMLDivElement>(null);
  const shortRef = useRef<HTMLDivElement>(null);
  const available = useElementWidth(containerRef);
  const [fitted, setFitted] = useState<{ hints: readonly KeyHint[]; short: boolean }>({
    hints,
    short: false,
  });

  useLayoutEffect(() => {
    const full = fullRef.current;
    const shortColumn = shortRef.current;
    if (full === null || shortColumn === null || available === undefined) return;

    const byFull = measured(full);
    const keptFull = fitHints(hints, byFull.widths, available, byFull.gap);
    if (keptFull.length === hints.length) {
      setFitted({ hints: keptFull, short: false });
      return;
    }
    // 落とす前に短い言い方を試す。キーを消すより語を縮める方が P5 に沿う（D-44）
    const byShort = measured(shortColumn);
    const keptShort = fitHints(hints, byShort.widths, available, byShort.gap);
    setFitted(
      keptShort.length > keptFull.length
        ? { hints: keptShort, short: true }
        : { hints: keptFull, short: false },
    );
  }, [hints, available]);

  return (
    <div
      ref={containerRef}
      className="relative flex min-w-0 flex-1 items-center gap-3 overflow-hidden"
    >
      {fitted.hints.map((hint) => (
        <HintItem key={hint.id} hint={hint} short={fitted.short} />
      ))}
      <Measure innerRef={fullRef} hints={hints} short={false} />
      <Measure innerRef={shortRef} hints={hints} short />
    </div>
  );
}
