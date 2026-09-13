import { browser } from '#imports';
import { customHosts } from '@/lib/storage/options-items';

import { type ContentScriptSpec, createCustomDomainRegistry } from './customDomains';

/** manifest の静的な content script と同じ js・css・runAt をカスタムドメインにも当てる */
function staticContentScript(): ContentScriptSpec {
  const [script] = browser.runtime.getManifest().content_scripts ?? [];
  if (script?.js === undefined) throw new Error('manifest に content script が無い');
  return {
    js: script.js,
    ...(script.css === undefined ? {} : { css: script.css }),
    ...(script.run_at === undefined ? {} : { runAt: script.run_at }),
  };
}

const registry = createCustomDomainRegistry({
  requestOrigin: (origin) => browser.permissions.request({ origins: [origin] }),
  removeOrigin: (origin) => browser.permissions.remove({ origins: [origin] }),
  registerContentScript: (script) =>
    browser.scripting.registerContentScripts([
      {
        id: script.id,
        matches: script.matches,
        js: [...script.js],
        ...(script.css === undefined ? {} : { css: [...script.css] }),
        ...(script.runAt === undefined ? {} : { runAt: script.runAt }),
        persistAcrossSessions: true,
      },
    ]),
  unregisterContentScript: (id) => browser.scripting.unregisterContentScripts({ ids: [id] }),
  registeredIds: async () =>
    (await browser.scripting.getRegisteredContentScripts()).map((script) => script.id),
  contentScript: staticContentScript,
  hosts: { load: () => customHosts.getValue(), save: (hosts) => customHosts.setValue([...hosts]) },
});

/** 設定画面の「カスタムドメインを追加」から呼ぶ。permissions.request は利用者の操作の中で呼ぶ必要がある */
export const registerCustomHost = registry.register;
export const unregisterCustomHost = registry.unregister;
/** background の起動時に呼ぶ。保存済みで未登録のホストを登録し直す */
export const restoreCustomHosts = registry.restore;
