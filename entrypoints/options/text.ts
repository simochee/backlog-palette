import type { Settings } from '@/lib/storage/palette-items';

/*
 * 設定画面の container が持つ文言。部品の辞書（components/labels）は部品が要る語だけを
 * 持つので、セクションの見出しや説明はここに置く。言語は settings.language で選ぶ。
 */
export type OptionsText = {
  display: {
    title: string;
    theme: string;
    themes: Record<Settings['theme'], string>;
    language: string;
    languages: Record<Settings['language'], string>;
  };
  learning: {
    title: string;
    toggle: string;
    toggleDescription: string;
    clear: string;
    clearDescription: string;
    clearButton: string;
    clearConfirm: string;
    cleared: string;
  };
  history: { title: string; toggle: string; description: string };
  telemetry: { title: string; toggle: string; description: string };
  shortcuts: {
    title: string;
    current: (key: string) => string;
    description: string;
    change: string;
  };
  about: {
    title: string;
    version: (version: string) => string;
    privacy: string;
    repository: string;
  };
};

const ja: OptionsText = {
  display: {
    title: '表示',
    theme: '配色',
    themes: { system: 'システムに追従', light: 'ライト', dark: 'ダーク' },
    language: '言語',
    languages: { system: 'ブラウザに従う', ja: '日本語', en: 'English' },
  },
  learning: {
    title: '学習',
    toggle: '並び順の学習',
    toggleDescription:
      'オフにすると行動の記録と並び順への反映を止めます。これまでの記録は消しません',
    clear: '履歴を消去',
    clearDescription:
      '行動ログ・表示キャッシュ・検索履歴・クエリ辞書を消します。接続とキーは残ります',
    clearButton: '消去',
    clearConfirm: '本当に消去',
    cleared: '消去しました',
  },
  history: {
    title: 'ブラウザ履歴',
    toggle: 'ブラウザ履歴から最近の課題を取り込む',
    description:
      'オンにするとブラウザの閲覧履歴を読む権限を求めます。読むのは Backlog のページだけです',
  },
  telemetry: {
    title: '利用状況',
    toggle: '利用状況の送信',
    description: '送るのは操作の種類と件数だけです。検索語・件名・課題キーは送りません',
  },
  shortcuts: {
    title: 'ショートカット',
    current: (key) => `現在の割り当て: ${key}`,
    description: 'ブラウザの拡張機能の設定で変更できます。このページでは変えられません',
    change: '変更する',
  },
  about: {
    title: 'このアプリについて',
    version: (version) => `バージョン ${version}`,
    privacy: 'API キーは端末内の拡張機能ストレージに保存されます。外部には送信しません',
    repository: 'リポジトリ',
  },
};

const en: OptionsText = {
  display: {
    title: 'Appearance',
    theme: 'Color scheme',
    themes: { system: 'Follow system', light: 'Light', dark: 'Dark' },
    language: 'Language',
    languages: { system: 'Follow browser', ja: '日本語', en: 'English' },
  },
  learning: {
    title: 'Learning',
    toggle: 'Learn ordering from use',
    toggleDescription:
      'Turning this off stops recording and ranking by use. Existing records are kept',
    clear: 'Clear history',
    clearDescription:
      'Clears activity, display cache, search history and query dictionary. Connections and keys stay',
    clearButton: 'Clear',
    clearConfirm: 'Really clear',
    cleared: 'Cleared',
  },
  history: {
    title: 'Browser history',
    toggle: 'Import recent issues from browser history',
    description:
      'Turning this on asks for permission to read your browsing history. Only Backlog pages are read',
  },
  telemetry: {
    title: 'Usage data',
    toggle: 'Send usage data',
    description: 'Only event types and counts are sent. Queries, titles and issue keys never are',
  },
  shortcuts: {
    title: 'Shortcut',
    current: (key) => `Current: ${key}`,
    description: 'Change it in the browser’s extension settings. It cannot be changed here',
    change: 'Change',
  },
  about: {
    title: 'About',
    version: (version) => `Version ${version}`,
    privacy:
      'API keys are stored in the extension’s local storage on this device and never sent out',
    repository: 'Repository',
  },
};

export type Locale = 'ja' | 'en';

/** 「ブラウザに従う」はブラウザの UI 言語（surfaces.md §9）。日本語以外はすべて英語 */
export function resolveLocale(language: Settings['language'], uiLanguage: string): Locale {
  if (language !== 'system') return language;
  return uiLanguage.toLowerCase().startsWith('ja') ? 'ja' : 'en';
}

export const optionsText: Record<Locale, OptionsText> = { ja, en };
