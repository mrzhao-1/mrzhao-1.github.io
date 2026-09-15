#!/usr/bin/env node
/**
 * 生成项目页快照：assets/data/repos.json
 * ======================================
 * 作用：调用 GitHub API 拉取 mrzhao-1 名下的全部公开仓库，整理成项目页直接可用的
 *       快照文件。网站首屏读的就是这个文件，所以它必须保持最新。
 *
 * 为什么需要这个脚本：
 *   项目页原来只靠浏览器实时调 GitHub API，一旦接口限流或者网络不通，
 *   页面就停在旧数据上，新建的仓库永远不会出现，而且页面上不会有任何报错。
 *   这个脚本由 GitHub Actions 每天定时执行，把快照更新到最新，实时接口挂掉也不影响。
 *
 * 用法：
 *   本地跑：node scripts/update-repos.mjs
 *   带令牌跑（避免限流，可选）：GITHUB_TOKEN=xxx node scripts/update-repos.mjs
 *
 * 说明：fork 仓库的 language 字段 GitHub API 返回 null，这里改用父仓库的语言补上，
 *      让快照里的语言信息和卡片显示保持一致。
 *
 * 注意：未认证时 GitHub 每小时只有 60 次额度，跑两三次就会用光。父仓库查询失败时
 *      脚本会沿用上一次快照里记录的语言，不会把已有信息抹成 null。
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const USERNAME = 'mrzhao-1';
const API = 'https://api.github.com';
const OUTPUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'data', 'repos.json');
// 本站仓库本身不进快照：前端本来就会过滤掉它，留着只会让它的 updated_at
// 每次 push 都变，进而让 Actions 每天都产生一条无意义的空提交。
const SITE_REPO = USERNAME + '.github.io';

const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';

const HEADERS = {
  Accept: 'application/vnd.github+json',
  'User-Agent': 'mrzhao-1-site-snapshot',
  'X-GitHub-Api-Version': '2022-11-28'
};
if (TOKEN) HEADERS.Authorization = `Bearer ${TOKEN}`;

let lookupFailed = 0;

async function getJSON(url) {
  const resp = await fetch(url, { headers: HEADERS });
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`HTTP ${resp.status} ${resp.statusText} <- ${url}\n${body.slice(0, 300)}`);
  }
  return resp.json();
}

// 分页拉取全部仓库
async function listRepos() {
  const all = [];
  for (let page = 1; ; page++) {
    const batch = await getJSON(`${API}/users/${USERNAME}/repos?per_page=100&sort=updated&page=${page}`);
    all.push(...batch);
    if (batch.length < 100) break;
  }
  return all;
}

// 读取上一次的快照，用于父仓库查询失败时兜底
async function readPrevious() {
  try {
    const arr = JSON.parse(await readFile(OUTPUT, 'utf8'));
    const map = new Map();
    if (Array.isArray(arr)) arr.forEach((r) => map.set(r.name, r));
    return map;
  } catch {
    return new Map();
  }
}

// fork 仓库在列表接口里 language 是 null，去单仓库接口读父仓库的语言补上。
// 查询失败（限流、网络不通）时沿用上一次快照里的语言，避免把已有信息抹成 null。
async function resolveLanguage(repo, previous) {
  if (repo.language) return repo.language;
  if (!repo.fork) return null;

  try {
    const full = await getJSON(`${API}/repos/${repo.full_name}`);
    const lang = (full.parent && full.parent.language) || null;
    if (lang) return lang;
  } catch (err) {
    lookupFailed += 1;
    console.warn(`  ! ${repo.name} 父仓库查询失败：${err.message.split('\n')[0]}`);
  }

  const prev = previous.get(repo.name);
  if (prev && prev.language) {
    console.warn(`    -> 沿用上次记录的语言：${prev.language}`);
    return prev.language;
  }
  console.warn('    -> 没有历史值可用，这个仓库暂时没有语言标签');
  return null;
}

// 只保留项目页真正用到的字段，顺序固定，方便 diff 阅读
function pick(repo, language) {
  return {
    name: repo.name,
    description: repo.description || '',
    html_url: repo.html_url,
    fork: repo.fork,
    language: language,
    stargazers_count: repo.stargazers_count || 0,
    updated_at: repo.updated_at,
    topics: repo.topics || []
  };
}

async function main() {
  console.log(`拉取 ${USERNAME} 的仓库列表${TOKEN ? '（已带令牌）' : '（未带令牌）'}...`);
  const previous = await readPrevious();
  const repos = (await listRepos()).filter((r) => r.name !== SITE_REPO);
  console.log(`  共 ${repos.length} 个仓库`);

  // 排序固定：原创在前，其次按名称。保证数据没变时文件字节不变，Actions 不会产生空提交。
  repos.sort((a, b) => {
    if (a.fork !== b.fork) return a.fork ? 1 : -1;
    return a.name.localeCompare(b.name);
  });

  const needLanguage = repos.filter((r) => !r.language && r.fork).length;
  if (needLanguage) console.log(`  其中 ${needLanguage} 个 fork 需要补语言，逐个查询父仓库...`);

  const out = [];
  for (const repo of repos) {
    const language = await resolveLanguage(repo, previous);
    out.push(pick(repo, language));
    process.stdout.write(`  ✓ ${repo.name}${language ? ` (${language})` : ''}\n`);
  }

  await writeFile(OUTPUT, JSON.stringify(out, null, 2) + '\n', 'utf8');
  console.log(`\n已写入 ${OUTPUT}`);
  console.log(`共 ${out.length} 个仓库，其中原创 ${out.filter((r) => !r.fork).length} 个、fork ${out.filter((r) => r.fork).length} 个。`);
  if (lookupFailed) {
    console.warn('');
    console.warn(`注意：有 ${lookupFailed} 个仓库的父仓库查询失败。`);
    console.warn('未认证时 GitHub 每小时只有 60 次额度，带上令牌可以避免：');
    console.warn('  GITHUB_TOKEN=xxx node scripts/update-repos.mjs');
    console.warn('失败的已沿用上次快照里的语言，新加的 fork 才会暂时没有语言标签。');
  }
}

main().catch((err) => {
  console.error('生成快照失败：', err.message);
  process.exit(1);
});
