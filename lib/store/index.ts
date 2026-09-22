import type { Store } from '@tanstack/store';

/** 購読と読み取りだけを渡す形。書き込みは持ち主（Store を作った側）に閉じる */
export type Readable<T> = Pick<Store<T>, 'get' | 'subscribe'>;
