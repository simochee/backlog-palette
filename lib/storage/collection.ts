import {
  type CollectionConfig,
  createCollection,
  deepEquals,
  type InferSchemaOutput,
  type StandardSchema,
} from '@tanstack/db';

/** zod など Standard Schema の任意のスキーマ。行の型はスキーマから引く */
type AnySchema = StandardSchema<object>;

/** defineItem の要る面だけ。テストは偽の item を渡す */
export type StorageItemLike<T> = {
  getValue: () => Promise<T>;
  setValue: (value: T) => Promise<void>;
  watch: (callback: (newValue: T, oldValue: T) => void) => () => void;
};

export type StorageCollectionConfig<TSchema extends AnySchema, TKey extends string | number> = {
  id: string;
  item: StorageItemLike<InferSchemaOutput<TSchema>[]>;
  getKey: (row: InferSchemaOutput<TSchema>) => TKey;
  schema: TSchema;
};

type Change<T> = { type: 'insert' | 'update' | 'delete'; value: T };

type Mutation<T, TKey> = { type: 'insert' | 'update' | 'delete'; key: TKey; modified: T };

type SyncParams<T> = {
  begin: () => void;
  write: (message: Change<T>) => void;
  commit: () => unknown;
  markReady: () => void;
};

function diff<T extends object, TKey>(
  previous: ReadonlyMap<TKey, T>,
  next: ReadonlyMap<TKey, T>,
): Change<T>[] {
  const changes: Change<T>[] = [];
  for (const [key, value] of previous) {
    const after = next.get(key);
    if (after === undefined) changes.push({ type: 'delete', value });
    else if (!deepEquals(value, after)) changes.push({ type: 'update', value: after });
  }
  for (const [key, value] of next) if (!previous.has(key)) changes.push({ type: 'insert', value });
  return changes;
}

/**
 * storage の中身（known）と DB の中身を同じに保つ。差分だけを 1 トランザクションで DB に書く。
 * 自分の書き込みも watch に届くが、書く前に known を更新しているので差分が空になり二重に反映しない
 */
class Mirror<T extends object, TKey extends string | number> {
  private readonly known = new Map<TKey, T>();
  private params: SyncParams<T> | undefined;

  constructor(
    private readonly item: StorageItemLike<T[]>,
    private readonly getKey: (row: T) => TKey,
  ) {}

  private toMap(rows: readonly T[]): Map<TKey, T> {
    return new Map(rows.map((row) => [this.getKey(row), row]));
  }

  private apply(next: ReadonlyMap<TKey, T>): void {
    const changes = diff(this.known, next);
    this.known.clear();
    for (const [key, value] of next) this.known.set(key, value);
    if (this.params === undefined || changes.length === 0) return;
    this.params.begin();
    for (const change of changes) this.params.write(change);
    this.params.commit();
  }

  /** 初期読み込みは getValue、他の拡張ページの変更は item.watch で購読する */
  sync(params: SyncParams<T>): () => void {
    this.params = params;
    let unwatch: (() => void) | undefined;
    void (async () => {
      this.apply(this.toMap(await this.item.getValue()));
      params.markReady();
      unwatch = this.item.watch((value) => {
        this.apply(this.toMap(value));
      });
    })();
    return () => unwatch?.();
  }

  /** 変更は setValue で storage へ。DB 側は confirm として同じ差分を書く */
  async persist(mutations: readonly Mutation<T, TKey>[]): Promise<void> {
    const next = new Map(this.known);
    for (const mutation of mutations) {
      if (mutation.type === 'delete') next.delete(mutation.key);
      else next.set(mutation.key, mutation.modified);
    }
    this.apply(next);
    await this.item.setValue([...next.values()]);
  }
}

/**
 * defineItem を TanStack DB のコレクションにする adapter。DB は 1.0 前なので、API が変わっても
 * 直すのはこの 1 ファイルだけにする（tech-stack §3.2・§4）
 */
export function storageCollectionOptions<TSchema extends AnySchema, TKey extends string | number>(
  config: StorageCollectionConfig<TSchema, TKey>,
): CollectionConfig<InferSchemaOutput<TSchema>, TKey, TSchema> & { schema: TSchema } {
  const mirror = new Mirror<InferSchemaOutput<TSchema>, TKey>(config.item, config.getKey);
  return {
    id: config.id,
    getKey: config.getKey,
    schema: config.schema,
    sync: { sync: (params) => mirror.sync(params) },
    onInsert: ({ transaction }) => mirror.persist(transaction.mutations),
    onUpdate: ({ transaction }) => mirror.persist(transaction.mutations),
    onDelete: ({ transaction }) => mirror.persist(transaction.mutations),
  };
}

export function createStorageCollection<TSchema extends AnySchema, TKey extends string | number>(
  config: StorageCollectionConfig<TSchema, TKey>,
) {
  return createCollection(storageCollectionOptions(config));
}
