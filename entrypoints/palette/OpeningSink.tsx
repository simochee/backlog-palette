import { useEffect, useRef } from 'react';

type Props = {
  onTyped: (value: string) => void;
  onEscape: () => void;
};

/**
 * パレットが描かれていない間、打鍵を受け止める入力欄。見えないが焦点を持つ。
 *
 * content script は iframe.focus() の直後に open を postMessage するが、メッセージは
 * 次のタスクで届く。その隙に打たれた文字は焦点を持つ要素が無いと iframe の document に
 * 落ちて消える（mvp の罠と同じ形）。window が焦点を受けた瞬間に自分へ焦点を移すことで、
 * open が届く前でも文字を受け取れる。IME の変換途中でパレットに置き換わると変換は
 * 切れるが、確定済みの文字は残る
 */
export function OpeningSink({ onTyped, onEscape }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const focus = () => ref.current?.focus();
    focus();
    window.addEventListener('focus', focus);
    return () => {
      window.removeEventListener('focus', focus);
    };
  }, []);
  return (
    <input
      ref={ref}
      aria-hidden
      tabIndex={-1}
      className="fixed top-0 left-0 h-px w-px opacity-0"
      onInput={(event) => onTyped(event.currentTarget.value)}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !event.nativeEvent.isComposing) onEscape();
      }}
    />
  );
}
