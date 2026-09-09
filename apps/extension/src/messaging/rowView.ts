import type { RowView as CoreRowView } from '@backlog-palette/core';
import type { RowProps } from '@backlog-palette/ui';

/**
 * packages/core の表示語彙と packages/ui の props を突き合わせる唯一の場所。
 *
 * 両パッケージは互いを import しない（§6.2）ので、構造的に一致していることを
 * ここで型として主張する。片方だけ変更するとこのファイルが型エラーになる。
 */
export type RowView = CoreRowView;

type Expect<T extends true> = T;
type Assignable<From, To> = [From] extends [To] ? true : false;

export type _CoreRowViewFitsUiProps = Expect<Assignable<CoreRowView, RowProps>>;
export type _UiPropsFitCoreRowView = Expect<Assignable<RowProps, CoreRowView>>;
