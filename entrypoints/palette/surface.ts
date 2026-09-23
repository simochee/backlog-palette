import type { Labels } from '@/components/labels';
import type { PaletteCallbacks } from '@/components/organisms/Palette';
import type { PaletteView } from '@/components/types';
import { resolveLanguage } from '@/lib/i18n/language';
import { detectPlatform } from '@/lib/keys';
import { type AssignedState, derive, type PaletteState, preparingView } from '@/lib/palette';
import { scopeOf } from '@/lib/stack/stack';

import type { ActionEnv } from './actions.ts';
import { paletteCallbacks } from './callbacks.ts';
import type { PaletteController } from './controller.ts';
import type { PaletteSession } from './createSession.ts';
import { labelsFor } from './language.ts';
import { paletteTelemetry } from './telemetry.ts';

const noop = () => {};

export type Surface = { labels: Labels; view: PaletteView; callbacks: PaletteCallbacks };

/**
 * 材料が届く前の面。入力欄だけを描き、打った文字を Store に貯める。材料が揃ったら同じ入力の
 * まま行を描く（palette.md §3）。言語の設定はまだ読めていないので、ブラウザの言語で描く
 */
export function preparingSurface(state: PaletteState, controller: PaletteController): Surface {
  const { store, close } = controller;
  const labels = labelsFor(resolveLanguage('system', navigator.language));
  return {
    labels,
    view: preparingView(state, labels),
    callbacks: {
      onInputChange: (value) => {
        paletteTelemetry.typed();
        store.dispatch({ type: 'inputChanged', value });
      },
      onEscape: close,
      onDismiss: close,
      onSelectionChange: noop,
      onAction: noop,
      onTake: noop,
      onBackspaceAtStart: noop,
    },
  };
}

export type Ready = {
  session: PaletteSession;
  controller: PaletteController;
  state: PaletteState;
  assigned: AssignedState;
  panelAvailable: boolean;
};

export function readySurface({ session, controller, state, assigned, panelAvailable }: Ready) {
  const { store, pending, close } = controller;
  const { labels, context, runner } = session;
  // 担当課題は届いた時点で索引に足す。届くまでは表示キャッシュだけで描く（palette.md §9）
  const index = { ...session.index, assigned };
  const derived = derive(state, index, labels, { platform: detectPlatform(), panelAvailable });
  const env: ActionEnv = {
    context,
    labels,
    learningEnabled: index.learningEnabled,
    runner,
    query: state.input.trim(),
    scope: scopeOf(state.stack),
    dispatch: store.dispatch,
    close,
    now: Date.now,
  };
  const callbacks = paletteCallbacks({ store, derived, env, pending, stack: state.stack, close });
  return { surface: { labels, view: derived.view, callbacks }, env };
}
