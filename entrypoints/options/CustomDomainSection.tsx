import { CustomDomainForm } from '@/components/organisms/CustomDomainForm';
import { customHosts } from '@/lib/storage/options-items';

import { useStorageItem } from './useStorageItem.ts';

/*
 * ここでは一覧の読み書きだけ。permissions.request({ origins }) と content script の
 * 動的登録（surfaces.md §8）は、この item を読む側が行う。
 */
export function CustomDomainSection() {
  const hosts = useStorageItem(customHosts);
  if (hosts === undefined) return null;
  return (
    <CustomDomainForm
      hosts={hosts}
      onAdd={(host) => {
        const normalized = host.toLowerCase();
        if (hosts.includes(normalized)) return;
        void customHosts.setValue([...hosts, normalized]);
      }}
      onRemove={(host) => void customHosts.setValue(hosts.filter((h) => h !== host))}
    />
  );
}
