import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createStorageCollection, type StorageItemLike } from './collection';

const rowSchema = z.object({ id: z.string(), title: z.string() });
type Row = z.infer<typeof rowSchema>;
const options = (id: string, item: StorageItemLike<Row[]>) => ({
  id,
  item,
  getKey: (r: Row) => r.id,
  schema: rowSchema,
});

/** defineItem の代わり。他の拡張ページからの変更は emit で再現する */
function fakeItem(initial: Row[]) {
  let value = initial;
  const listeners = new Set<(next: Row[], previous: Row[]) => void>();
  const item: StorageItemLike<Row[]> = {
    getValue: () => Promise.resolve(value),
    setValue: (next) => {
      value = next;
      return Promise.resolve();
    },
    watch: (callback) => {
      listeners.add(callback);
      return () => {
        listeners.delete(callback);
      };
    },
  };
  return {
    item,
    stored: () => value,
    emit: (next: Row[]) => {
      const previous = value;
      value = next;
      for (const listener of listeners) listener(next, previous);
    },
  };
}

const rows = (collection: { toArray: Row[] }) =>
  collection.toArray.map((r) => r.id).toSorted((a, b) => a.localeCompare(b));

describe('defineItem をコレクションにする adapter', () => {
  it('初期読み込みで storage の値がコレクションに載る', async () => {
    const { item } = fakeItem([{ id: 'a', title: 'A' }]);
    const collection = createStorageCollection(options('t1', item));
    await collection.preload();
    expect(rows(collection)).toEqual(['a']);
  });

  it('insert すると storage に書かれる', async () => {
    const fake = fakeItem([]);
    const collection = createStorageCollection(options('t2', fake.item));
    await collection.preload();
    await collection.insert({ id: 'b', title: 'B' }).isPersisted.promise;
    expect(fake.stored()).toEqual([{ id: 'b', title: 'B' }]);
    expect(rows(collection)).toEqual(['b']);
  });

  it('update と delete も storage に反映される', async () => {
    const fake = fakeItem([
      { id: 'a', title: 'A' },
      { id: 'b', title: 'B' },
    ]);
    const collection = createStorageCollection(options('t3', fake.item));
    await collection.preload();
    await collection.update('a', (draft) => {
      draft.title = 'A2';
    }).isPersisted.promise;
    await collection.delete('b').isPersisted.promise;
    expect(fake.stored()).toEqual([{ id: 'a', title: 'A2' }]);
    expect(rows(collection)).toEqual(['a']);
  });
});

describe('他の拡張ページとの同期', () => {
  it('他の拡張ページの変更は watch で届き、コレクションが追従する', async () => {
    const fake = fakeItem([{ id: 'a', title: 'A' }]);
    const collection = createStorageCollection(options('t4', fake.item));
    await collection.preload();
    fake.emit([
      { id: 'a', title: 'A' },
      { id: 'c', title: 'C' },
    ]);
    expect(rows(collection)).toEqual(['a', 'c']);
    fake.emit([{ id: 'c', title: 'C2' }]);
    expect(rows(collection)).toEqual(['c']);
    expect(collection.get('c')?.title).toBe('C2');
  });

  it('自分の書き込みが watch で戻ってきても二重に反映しない', async () => {
    const fake = fakeItem([]);
    const collection = createStorageCollection(options('t5', fake.item));
    await collection.preload();
    await collection.insert({ id: 'b', title: 'B' }).isPersisted.promise;
    fake.emit(fake.stored());
    expect(collection.toArray.map((r) => r.title)).toEqual(['B']);
  });
});

describe('購読が途切れた後の同期し直し', () => {
  it('コレクションを片付けてから読み直しても、storage の行が揃う', async () => {
    const { item } = fakeItem([{ id: 'a', title: 'A' }]);
    const collection = createStorageCollection(options('t6', item));
    await collection.preload();
    await collection.cleanup();
    await collection.preload();
    expect(rows(collection)).toEqual(['a']);
  });
});
