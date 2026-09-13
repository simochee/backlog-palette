import { type RefObject, useEffect, useRef, useState } from 'react';

import { isPaletteHotkey } from '@/lib/hotkey/paletteHotkey';

import { hostChannel } from './hostChannel.ts';
import { resolveSpaceFromTab } from './space.ts';

/*
 * 表示・非表示は content script が iframe ごと切り替えるので、iframe の中では
 * open のたびに入力欄を空にしてフォーカスを移すだけ（palette.md §3「前回の入力は残さない」）。
 */
function useOpenResetsInput(inputRef: RefObject<HTMLInputElement | null>) {
  useEffect(
    () =>
      hostChannel.subscribe((message) => {
        const input = inputRef.current;
        if (message.t !== 'open' || input === null) return;
        input.value = '';
        input.focus();
      }),
    [inputRef],
  );

  /*
   * content script の iframe.focus() は同期だが、open メッセージは非同期に届く。
   * その隙に打たれたキーは iframe の document に落ちて消えるので、window が
   * フォーカスを受けた時点で入力欄に移しておく。
   */
  useEffect(() => {
    const focusInput = () => inputRef.current?.focus();
    window.addEventListener('focus', focusInput);
    return () => {
      window.removeEventListener('focus', focusInput);
    };
  }, [inputRef]);
}

function usePaletteKeys() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // 変換中のキーは捨てる（I5）。変換確定の Enter で遷移させない
      if (event.isComposing) return;
      const isClose = event.key === 'Escape' || isPaletteHotkey(event, navigator.platform);
      /*
       * Enter で閉じるのは M5 で行の動作（遷移）に差し替わるまでの代役。
       * 「変換中の Enter では起きず、確定後の Enter では起きる」結果を
       * E2E が観測できる動作が 1 つ要る。
       */
      if (!isClose && event.key !== 'Enter') return;
      event.preventDefault();
      hostChannel.send({ t: 'close' });
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true });
    };
  }, []);
}

/** open のたびにタブ URL からスペースを決め直す。タブの URL は開いている間に変わりうる */
function useSpaceOfTab(): string | undefined {
  const [space, setSpace] = useState<string>();
  useEffect(
    () =>
      hostChannel.subscribe((message) => {
        if (message.t !== 'open') return;
        void resolveSpaceFromTab().then(setSpace);
      }),
    [],
  );
  return space;
}

/** M5 までの暫定。components/ の部品は使わず、入力欄 1 つだけを置く */
export function Palette() {
  const inputRef = useRef<HTMLInputElement>(null);
  useOpenResetsInput(inputRef);
  usePaletteKeys();
  const space = useSpaceOfTab();

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'start center' }}>
      <input
        ref={inputRef}
        aria-label="Backlog Palette"
        placeholder={space === undefined ? '' : `${space} で検索`}
        style={{ marginTop: '15vh', width: 640 }}
      />
    </div>
  );
}
