import type { ReactNode } from 'react';

type OptionsSection = {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
};

type OptionsLayoutProps = {
  title: string;
  sections: readonly OptionsSection[];
};

/** 設定画面の 1 カラム配置（surfaces.md §2）。保存ボタンは無く、各行がその場で書き戻す */
export function OptionsLayout({ title, sections }: OptionsLayoutProps) {
  return (
    <main className="mx-auto flex w-full max-w-(--bp-width-options) flex-col gap-6 px-4 py-6 font-body text-default">
      <h1 className="text-lg font-semibold">{title}</h1>
      {sections.map((section) => {
        const headingId = `options-${section.id}`;
        return (
          <section
            key={section.id}
            aria-labelledby={headingId}
            className="rounded-surface border border-border bg-floating px-4 py-2"
          >
            <h2 id={headingId} className="pt-2 text-md font-semibold">
              {section.title}
            </h2>
            {section.description !== undefined && (
              <p className="pb-1 text-sm text-subtle">{section.description}</p>
            )}
            {section.children}
          </section>
        );
      })}
    </main>
  );
}
