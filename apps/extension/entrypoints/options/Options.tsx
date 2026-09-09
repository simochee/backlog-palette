import { Button, ChoiceGroup, Marker, Section, SettingRow, Switch } from '@backlog-palette/ui';
import { useEffect, useState } from 'react';
import {
  currentHistoryImport,
  type HistoryImportOutcome,
  isHistoryImportOn,
  setHistoryImport,
} from '../../src/services/historyImport.ts';
import { loadSettings, resolveColorScheme, updateSettings } from '../../src/services/settings.ts';
import { loadSpaceSummaries, type SpaceSummary } from '../../src/services/spaceView.ts';
import { clearHistory } from '../../src/storage/displayCache.ts';
import { DEFAULT_SETTINGS, type Settings } from '../../src/storage/schema.ts';

const SURFACE_CHOICES = [
  { value: 'modal', label: 'モーダル' },
  { value: 'panel', label: 'サイドパネル' },
] as const satisfies readonly { value: Settings['defaultSurface']; label: string }[];

const SCHEME_CHOICES = [
  { value: 'system', label: 'システムに追従' },
  { value: 'light', label: 'ライト' },
  { value: 'dark', label: 'ダーク' },
] as const satisfies readonly { value: Settings['colorScheme']; label: string }[];

const STATE_MARKER = {
  connected: { label: '接続済み', tone: 'success' },
  needsReconnect: { label: '要再接続', tone: 'warning' },
} as const;

type ClearStep = 'idle' | 'confirming' | 'cleared';

function usePrefersDark(): boolean {
  const [prefersDark, setPrefersDark] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    setPrefersDark(query.matches);

    const onChange = (event: MediaQueryListEvent) => setPrefersDark(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return prefersDark;
}

function SpaceRows({ spaces }: { spaces: readonly SpaceSummary[] }) {
  if (spaces.length === 0) {
    return (
      <SettingRow
        label="接続済みのスペースはまだありません"
        description="Backlog のページで ⌘K を押すと、その場で接続できます。"
      />
    );
  }

  return (
    <>
      {spaces.map((space) => (
        <SettingRow
          key={space.spaceKey}
          label={space.displayName}
          description={space.detail}
          control={
            <>
              <Marker {...STATE_MARKER[space.state]} dot />
              {space.state === 'needsReconnect' ? <Button isDisabled>再接続</Button> : null}
              <Button isDisabled>削除</Button>
            </>
          }
        />
      ))}
    </>
  );
}

export function Options() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [spaces, setSpaces] = useState<readonly SpaceSummary[]>([]);
  const [historyImport, setHistoryImportState] = useState<HistoryImportOutcome>('disabled');
  const [clearStep, setClearStep] = useState<ClearStep>('idle');
  const prefersDark = usePrefersDark();

  useEffect(() => {
    void loadSettings().then(setSettings);
    void loadSpaceSummaries(Date.now()).then(setSpaces);
    void currentHistoryImport().then(setHistoryImportState);
  }, []);

  const save = (patch: Partial<Settings>) => {
    setSettings((current) => ({ ...current, ...patch }));
    void updateSettings(patch).then(setSettings);
  };

  const toggleHistoryImport = (desired: boolean) => {
    void setHistoryImport(desired).then(setHistoryImportState);
  };

  const clear = () => {
    void clearHistory().then(() => setClearStep('cleared'));
  };

  return (
    <div
      className="page"
      data-bp-theme=""
      data-bp-scheme={resolveColorScheme(settings.colorScheme, prefersDark)}
    >
      <div className="content">
        <header>
          <h1 className="pageTitle">Backlog Palette の設定</h1>
          <p className="pageLead">変更した内容はその場で保存されます。</p>
        </header>

        <Section
          title="接続済みスペース"
          description="スペースの接続・再接続・削除は、まだこの画面からは行えません。次のバージョンで使えるようになります。API キーで接続したスペースは、キーが端末内に平文で保存されています。"
        >
          <SpaceRows spaces={spaces} />
        </Section>

        <Section
          title="パレットの開き方"
          description="⌘K（Windows は Ctrl+K）で開きます。キーの割り当てはブラウザの拡張機能のショートカット設定から変えられます。"
        >
          <SettingRow
            label="既定のサーフェス"
            description="⌘K を押したときに出るもの。サイドパネルは ⌘⇧K でいつでも開けます。"
            control={
              <ChoiceGroup
                label="既定のサーフェス"
                value={settings.defaultSurface}
                choices={SURFACE_CHOICES}
                onChange={(defaultSurface) => save({ defaultSurface })}
              />
            }
          />
          <SettingRow
            label="課題キーの入力を常に最優先にする"
            description="PROJ-123 の形を見つけたら、その課題へ移動する候補を先頭に固定します。学習の結果でも動きません。"
            control={
              <Switch
                label="課題キーの入力を常に最優先にする"
                isSelected={settings.issueKeyFirst}
                onChange={(issueKeyFirst) => save({ issueKeyFirst })}
              />
            }
          />
        </Section>

        <Section
          title="カラースキーム"
          description="Backlog 本体がライトのままでも、パレットだけダークにできます。"
        >
          <SettingRow
            label="配色"
            description="システムに追従を選ぶと、OS の設定が変わったときに合わせて切り替わります。"
            control={
              <ChoiceGroup
                label="配色"
                value={settings.colorScheme}
                choices={SCHEME_CHOICES}
                onChange={(colorScheme) => save({ colorScheme })}
              />
            }
          />
        </Section>

        <Section
          title="学習と履歴"
          description="記録はすべて端末内に残ります。いつでも消去できます。"
        >
          <SettingRow
            label="よく使う項目を学習して並び替える"
            description="開いた回数と直近の利用をローカルに記録し、候補の順序に反映します。サーバーには送信しません。"
            control={
              <Switch
                label="よく使う項目を学習して並び替える"
                isSelected={settings.learningEnabled}
                onChange={(learningEnabled) => save({ learningEnabled })}
              />
            }
          />

          <SettingRow
            label="ブラウザ履歴から最近の課題を取り込む"
            description={
              <>
                履歴の読み取り権限を追加で要求します。対象は *.backlog.jp / *.backlog.com
                のみ。取り込んだ内容は端末内に保存され、いつでも消去できます。
                {historyImport === 'declined' ? (
                  <>
                    <br />
                    <span className="noticeDanger">
                      権限が許可されなかったので、取り込みは行いません。許可しなくても他の機能はそのまま使えます。
                    </span>
                  </>
                ) : null}
              </>
            }
            control={
              <Switch
                label="ブラウザ履歴から最近の課題を取り込む"
                isSelected={isHistoryImportOn(historyImport)}
                onChange={toggleHistoryImport}
              />
            }
          />

          <SettingRow
            label="記録した履歴を消去する"
            description="最近開いた課題・Wiki と、並び替えに使っている記録が消えます。接続済みスペースとこの画面の設定は残ります。"
            control={
              <>
                <span className="notice" role="status">
                  {clearStep === 'cleared' ? '消去しました' : null}
                </span>
                {clearStep === 'confirming' ? (
                  <>
                    <span className="notice">元に戻せません。消しますか？</span>
                    <Button onPress={() => setClearStep('idle')}>やめる</Button>
                    <Button tone="danger" onPress={clear}>
                      消去する
                    </Button>
                  </>
                ) : (
                  <Button tone="danger" onPress={() => setClearStep('confirming')}>
                    履歴を消去
                  </Button>
                )}
              </>
            }
          />
        </Section>
      </div>
    </div>
  );
}
