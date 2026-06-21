const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const pagePath = path.join(root, 'blog', 'vbm-ei-alzheimers.html');
const page = fs.readFileSync(pagePath, 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');

test('文章 metadata、作者與日期正確', () => {
  assert.match(page, /朱國大 醫師/);
  assert.match(page, /2026 \/ 06 \/ 22/);
  assert.match(page, /<html lang="zh-TW">/);
  assert.doesNotMatch(page, /Author:\s*_+/);
});

test('文章包含 dashboard、三張 SVG 與兩個 scripts', () => {
  for (const token of [
    'id="vbm-dashboard"',
    'vbm-ei-brake-accelerator.svg',
    'vbm-ei-pipeline.svg',
    'vbm-ei-evidence-roadmap.svg',
    'vbm-ei-model.js',
    'vbm-ei-alzheimers.js',
  ]) assert.ok(page.includes(token), token);
});

test('文章清楚標示證據邊界', () => {
  for (const token of [
    '非診斷工具',
    'tau_i 延長不等同',
    'same-subject',
    '不是已驗證的臨床 biomarker',
  ]) assert.ok(page.includes(token), token);
});

test('所有本機 href 與 src 目標存在', () => {
  const links = [...page.matchAll(/(?:href|src)="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((target) => (
      !target.startsWith('http')
      && !target.startsWith('#')
      && !target.startsWith('mailto:')
    ));
  for (const target of links) {
    const clean = target.split('#')[0].split('?')[0];
    assert.ok(fs.existsSync(path.resolve(path.dirname(pagePath), clean)), target);
  }
});

test('首頁與 sitemap 包含新文章', () => {
  assert.match(index, /blog\/vbm-ei-alzheimers\.html/);
  assert.match(index, /2026 \/ 06 \/ 22/);
  assert.match(sitemap, /vbm-ei-alzheimers\.html/);
  assert.match(sitemap, /<lastmod>2026-06-22<\/lastmod>/);
});

test('成品沒有 placeholder 或錯誤署名', () => {
  assert.doesNotMatch(page, /\bTBD\b|\bTODO\b|____________/);
  assert.doesNotMatch(page, /許育瑞|作者待確認/);
});
