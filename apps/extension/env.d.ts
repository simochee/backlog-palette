/// <reference types="wxt/vite-builder-env" />

interface ImportMetaEnv {
  /** Backlog の OAuth アプリ。apps/extension/.env で渡す（配布物に載る） */
  readonly WXT_OAUTH_CLIENT_ID?: string;
  readonly WXT_OAUTH_CLIENT_SECRET?: string;
}
