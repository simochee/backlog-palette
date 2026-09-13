import { within } from 'storybook/test';

/** story の検査で繰り返す DOM の問い合わせ。data 属性は dataset で読む */
export const options = (canvasElement: HTMLElement): HTMLElement[] =>
  within(canvasElement).getAllByRole('option');

export const groups = (canvasElement: HTMLElement): HTMLElement[] =>
  Array.from(canvasElement.querySelectorAll<HTMLElement>('[role="group"]'));

export const sectionIds = (canvasElement: HTMLElement): Array<string | undefined> =>
  groups(canvasElement).map((group) => group.dataset.sectionId);

export const kindsIn = (root: HTMLElement | undefined): Array<string | undefined> =>
  Array.from(root?.querySelectorAll<HTMLElement>('[role="option"]') ?? []).map(
    (option) => option.dataset.kind,
  );

export const resultsGroup = (canvasElement: HTMLElement): HTMLElement | undefined =>
  groups(canvasElement).find((group) => group.dataset.sectionId === 'results');

/** フッターに見えているヒントの文言。測定用の複製（aria-hidden）は除く */
export const hintLabel = (canvasElement: HTMLElement, id: string): string =>
  Array.from(canvasElement.querySelectorAll<HTMLElement>(`[data-hint-id="${id}"]`)).find(
    (element) => element.closest('[aria-hidden="true"]') === null,
  )?.textContent ?? '';
