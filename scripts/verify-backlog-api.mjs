#!/usr/bin/env node
/**
 * Backlog API の未確認事項を実測する（実装プラン §18 の #1 と #5）。
 *
 * 使い方:
 *   BP_SPACE=your-space.backlog.jp BP_API_KEY=xxxx node scripts/verify-backlog-api.mjs
 *
 * 読み取りしかしない。課題やコメントの作成・更新・削除は行わない。
 * 出力は既定で標準出力のみ。--out <path> でファイルに書ける。
 *
 * 件名や本文はレポートに残さない。判定に必要な語だけを伏せ字なしで出す
 * ので、社外に共有する前に目で確認すること。
 */

const SPACE = process.env.BP_SPACE;
const API_KEY = process.env.BP_API_KEY;

if (SPACE === undefined || API_KEY === undefined) {
  console.error('BP_SPACE と BP_API_KEY を設定してください。');
  console.error(
    '  例: BP_SPACE=your-space.backlog.jp BP_API_KEY=xxxx node scripts/verify-backlog-api.mjs',
  );
  process.exit(1);
}

const BASE = `https://${SPACE}/api/v2`;
const lines = [];
const say = (text) => {
  console.log(text);
  lines.push(text);
};

let requestCount = 0;
let lastHeaders;

async function api(path, params = {}) {
  const url = new URL(BASE + path);
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const v of value) url.searchParams.append(`${key}[]`, String(v));
    } else if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }
  url.searchParams.set('apiKey', API_KEY);

  requestCount += 1;
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  lastHeaders = res.headers;

  if (!res.ok) {
    const body = await res.text();
    throw Object.assign(new Error(`${res.status} ${path}: ${body.slice(0, 200)}`), {
      status: res.status,
    });
  }
  return res.json();
}

/** 本文にだけ出てくる語を探す。件名に無い語で keyword を試すのが判定の要 */
function tokenOnlyInBody(subject, body) {
  const inSubject = new Set((subject ?? '').toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []);
  const candidates = (body ?? '').toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) ?? [];
  return candidates.find((token) => !inSubject.has(token) && !/^\d+$/.test(token));
}

say('# Backlog API 実測レポート');
say('');
say(`- スペース: ${SPACE}`);
say(`- 実行: ${new Date().toISOString()}`);
say('');

// ---- 1. 接続とプロジェクト ----
say('## 1. 接続');
const me = await api('/users/myself');
say(`- 認証: OK（userId ${me.id}）`);
const projects = await api('/projects');
say(`- 参加プロジェクト: ${projects.length} 件`);
say(
  `- プロジェクトキーの例: ${projects
    .slice(0, 5)
    .map((p) => p.projectKey)
    .join(', ')}`,
);
const keyCharset = [...new Set(projects.flatMap((p) => [...p.projectKey]))].sort().join('');
say(`- プロジェクトキーに出現した文字: \`${keyCharset}\``);
say('');

// ---- 2. keyword の一致範囲（未決 #1） ----
say('## 2. `keyword` の一致範囲（未決 #1）');

async function probeKeyword(label, listPath, fetchDetail, subjectOf, bodyOf) {
  try {
    const items = await api(listPath, { count: 100 });
    if (items.length === 0) {
      say(`- ${label}: 対象が 0 件で判定できない`);
      return;
    }

    let probe;
    for (const item of items.slice(0, 20)) {
      const detail = fetchDetail === undefined ? item : await fetchDetail(item);
      const token = tokenOnlyInBody(subjectOf(detail), bodyOf(detail));
      if (token !== undefined) {
        probe = { detail, token };
        break;
      }
    }

    if (probe === undefined) {
      say(`- ${label}: 件名に無く本文にある語が見つからず判定できない`);
      return;
    }

    const hits = await api(listPath, { keyword: probe.token, count: 100 });
    const found = hits.some((hit) => hit.id === probe.detail.id);
    say(
      `- ${label}: 本文にのみ含まれる語 \`${probe.token}\` で検索 → **${found ? '本文にも一致する' : '件名のみに一致する'}**（ヒット ${hits.length} 件）`,
    );
  } catch (error) {
    say(`- ${label}: 失敗 — ${error.message}`);
  }
}

await probeKeyword(
  '課題',
  '/issues',
  undefined,
  (issue) => issue.summary,
  (issue) => issue.description,
);

const firstProject = projects[0];
if (firstProject !== undefined) {
  await probeKeyword(
    'Wiki',
    '/wikis',
    async (wiki) => api(`/wikis/${wiki.id}`),
    (wiki) => wiki.name,
    (wiki) => wiki.content,
  );
}

// コメントへの一致は、コメント本文にだけある語で確認する
try {
  const issues = await api('/issues', { count: 20 });
  let probe;
  for (const issue of issues) {
    const comments = await api(`/issues/${issue.issueKey}/comments`, { count: 20 });
    for (const comment of comments) {
      const token = tokenOnlyInBody(`${issue.summary} ${issue.description ?? ''}`, comment.content);
      if (token !== undefined) {
        probe = { issue, token };
        break;
      }
    }
    if (probe !== undefined) break;
  }

  if (probe === undefined) {
    say('- 課題コメント: 判定できる語が見つからなかった');
  } else {
    const hits = await api('/issues', { keyword: probe.token, count: 100 });
    const found = hits.some((hit) => hit.id === probe.issue.id);
    say(
      `- 課題コメント: コメントにのみ含まれる語 \`${probe.token}\` で検索 → **${found ? 'コメントにも一致する' : 'コメントには一致しない'}**`,
    );
  }
} catch (error) {
  say(`- 課題コメント: 失敗 — ${error.message}`);
}
say('');

// ---- 3. ドキュメント ----
say('## 3. ドキュメント API');
try {
  const docs = await api('/documents', { projectIds: projects.slice(0, 5).map((p) => p.id) });
  const list = Array.isArray(docs) ? docs : (docs.documents ?? []);
  say(`- 一覧: OK（${list.length} 件）`);
  const first = list[0];
  if (first !== undefined) {
    say(`- レスポンスのキー: ${Object.keys(first).join(', ')}`);
    say(`- 本文 \`plain\` を含むか: ${'plain' in first ? 'はい' : 'いいえ'}`);
  }
} catch (error) {
  say(`- 一覧: 失敗 — ${error.message}（プランの想定と違う可能性。エンドポイントを要確認）`);
}
say('');

// ---- 4. マスタ ----
say('## 4. マスタ');
if (firstProject !== undefined) {
  try {
    const statuses = await api(`/projects/${firstProject.projectKey}/statuses`);
    say(
      `- ステータス（${firstProject.projectKey}）: ${statuses.map((s) => `${s.id}:${s.name}`).join(' / ')}`,
    );
    const types = await api(`/projects/${firstProject.projectKey}/issueTypes`);
    say(`- 課題種別: ${types.map((t) => `${t.name}(${t.color})`).join(' / ')}`);
  } catch (error) {
    say(`- マスタ: 失敗 — ${error.message}`);
  }
}
say('');

// ---- 5. レートリミット（未決 #5） ----
say('## 5. レートリミット（未決 #5）');
const rateHeaders = [...(lastHeaders?.entries() ?? [])].filter(([key]) =>
  key.toLowerCase().includes('rate'),
);
if (rateHeaders.length === 0) {
  say('- レート関連のレスポンスヘッダは見つからなかった');
} else {
  for (const [key, value] of rateHeaders) say(`- \`${key}\`: ${value}`);
}

const burst = 20;
const started = Date.now();
const results = await Promise.allSettled(Array.from({ length: burst }, () => api('/users/myself')));
const rejected = results.filter((r) => r.status === 'rejected');
say(`- 並列 ${burst} 本: 失敗 ${rejected.length} 件 / ${Date.now() - started}ms`);
if (rejected.length > 0) {
  say(`  - 最初の失敗: ${rejected[0].reason?.message?.slice(0, 120)}`);
}
say(`- 総リクエスト数: ${requestCount}`);
say('');
say('## 次にやること');
say('- `keyword` が件名のみだった場合、サイドパネルの「キーワード対象」に');
say('  「件名・本文（拡張側で照合）」を用意して劣化を見える形にする（§3 D5）');
say('- 並列本数の上限をレートリミットの実測値から決める（§7.4）');

const outIndex = process.argv.indexOf('--out');
if (outIndex !== -1) {
  const path = process.argv[outIndex + 1];
  if (path !== undefined) {
    const { writeFile } = await import('node:fs/promises');
    await writeFile(path, `${lines.join('\n')}\n`, 'utf8');
    console.error(`\n書き出しました: ${path}`);
  }
}
