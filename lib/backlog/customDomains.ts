/**
 * カスタムドメインの登録（surfaces.md §8）。ホストの権限を求め、許可されたら content
 * script を動的に登録して customHosts に残す。拡張機能 API は引数で受け、node で検査する。
 */
export type ContentScriptSpec = {
  js: readonly string[];
  css?: readonly string[];
  runAt?: 'document_start' | 'document_end' | 'document_idle';
};

export type CustomDomainApis = {
  requestOrigin: (origin: string) => Promise<boolean>;
  removeOrigin: (origin: string) => Promise<boolean>;
  registerContentScript: (script: ContentScriptSpec & { id: string; matches: string[] }) => Promise<void>;
  unregisterContentScript: (id: string) => Promise<void>;
  registeredIds: () => Promise<readonly string[]>;
  /** 静的に登録している content script。同じものをカスタムドメインにも当てる */
  contentScript: () => ContentScriptSpec;
  hosts: { load: () => Promise<readonly string[]>; save: (hosts: readonly string[]) => Promise<void> };
};

export type RegisterOutcome = 'granted' | 'denied';

const ID_PREFIX = 'backlog-palette:custom:';
export const contentScriptIdOf = (host: string): string => `${ID_PREFIX}${host}`;
export const originPatternOf = (host: string): string => `https://${host}/*`;

/** スキーム・パス・大文字を落としてホスト名だけにする。形式は未確認なので 1 ホスト単位（§8） */
export function normalizeHost(input: string): string {
  const trimmed = input.trim().toLowerCase();
  const withoutScheme = trimmed.replace(/^[a-z]+:\/\//u, '');
  return withoutScheme.split(/[/?#]/u)[0] ?? '';
}

export type CustomDomainRegistry = {
  register: (input: string) => Promise<RegisterOutcome>;
  unregister: (input: string) => Promise<void>;
  /** 起動時に customHosts の分を登録し直す。登録済みのものは触らない */
  restore: () => Promise<void>;
};

export function createCustomDomainRegistry(apis: CustomDomainApis): CustomDomainRegistry {
  const registerScript = (host: string) =>
    apis.registerContentScript({
      ...apis.contentScript(),
      id: contentScriptIdOf(host),
      matches: [originPatternOf(host)],
    });

  return {
    async register(input) {
      const host = normalizeHost(input);
      // 許可されてから保存する。保存だけ先に済ますと、権限の無いホストが一覧に残る
      const granted = await apis.requestOrigin(originPatternOf(host));
      if (!granted) return 'denied';
      const known = await apis.hosts.load();
      if (!known.includes(host)) await apis.hosts.save([...known, host]);
      if (!(await apis.registeredIds()).includes(contentScriptIdOf(host))) await registerScript(host);
      return 'granted';
    },

    async unregister(input) {
      const host = normalizeHost(input);
      const known = await apis.hosts.load();
      await apis.hosts.save(known.filter((candidate) => candidate !== host));
      if ((await apis.registeredIds()).includes(contentScriptIdOf(host))) {
        await apis.unregisterContentScript(contentScriptIdOf(host));
      }
      await apis.removeOrigin(originPatternOf(host));
    },

    async restore() {
      const [known, registered] = await Promise.all([apis.hosts.load(), apis.registeredIds()]);
      const missing = known.filter((host) => !registered.includes(contentScriptIdOf(host)));
      await Promise.all(missing.map((host) => registerScript(host)));
    },
  };
}
