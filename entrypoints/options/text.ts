/*
 * 設定画面の container が持つ文言。部品の辞書（components/labels）は部品が要る語だけを
 * 持つので、セクションの見出しや説明はここに置く。言語の切り替え（表示セクション）が
 * 入ったら en を足して settings.language で選ぶ。
 */
export const text = {
  shortcuts: {
    title: 'ショートカット',
    current: (key: string) => `現在の割り当て: ${key}`,
    description: 'ブラウザの拡張機能の設定で変更できます。このページでは変えられません',
    change: '変更する',
  },
  about: {
    title: 'このアプリについて',
    version: (version: string) => `バージョン ${version}`,
    privacy: 'API キーは端末内の拡張機能ストレージに保存されます。外部には送信しません',
    repository: 'リポジトリ',
  },
} as const;
