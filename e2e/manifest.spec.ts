import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { expect, test } from '@playwright/test';

type Manifest = {
  permissions?: string[];
  commands?: Record<string, { suggested_key?: unknown }>;
  content_scripts?: { js: string[] }[];
  side_panel?: { default_path: string };
  sidebar_action?: { default_panel: string };
  browser_specific_settings?: {
    gecko?: { id?: string; data_collection_permissions?: { required?: string[] } };
  };
  action?: { default_popup?: string };
  browser_action?: { default_popup?: string };
};

function readManifest(dir: string): Manifest {
  const path = resolve(import.meta.dirname, '../.output', dir, 'manifest.json');
  return JSON.parse(readFileSync(path, 'utf8')) as Manifest;
}

test.describe('ビルド後の manifest', () => {
  test('Chrome: content script と side_panel があり、commands に既定キーが無い', () => {
    const manifest = readManifest('chrome-mv3');

    expect(manifest.content_scripts?.[0]?.js).toEqual(['content-scripts/backlog.js']);
    expect(manifest.side_panel?.default_path).toBe('sidepanel.html');
    expect(manifest.permissions).toContain('sidePanel');
    expect(manifest.commands).toBeUndefined();
    expect(manifest.action?.default_popup).toBeUndefined();
  });

  test('Firefox: sidebar_action と gecko.id・data_collection_permissions があり、sidePanel 権限は無い', () => {
    const manifest = readManifest('firefox-mv2');

    expect(manifest.content_scripts?.[0]?.js).toEqual(['content-scripts/backlog.js']);
    expect(manifest.sidebar_action?.default_panel).toBe('sidepanel.html');
    expect(manifest.side_panel).toBeUndefined();
    expect(manifest.permissions).not.toContain('sidePanel');
    expect(manifest.browser_specific_settings?.gecko?.id).toMatch(/^[^@]+@[^@]+$/u);
    expect(
      manifest.browser_specific_settings?.gecko?.data_collection_permissions?.required,
    ).toEqual(['none']);
    expect(manifest.commands).toBeUndefined();
    expect(manifest.browser_action?.default_popup).toBeUndefined();
  });
});
