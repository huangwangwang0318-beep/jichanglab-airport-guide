import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {resolve, relative} from 'node:path';
import {execFileSync} from 'node:child_process';

const project = resolve(import.meta.dirname, '..');
const site = resolve(project, 'site');
const expected = [
  'assets/app.js',
  'assets/engine.mjs',
  'assets/site.css',
  'index.html',
];

function filesIn(directory) {
  return readdirSync(directory, {withFileTypes: true}).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    assert.ok(!entry.isSymbolicLink(), `Pages payload contains a symlink: ${path}`);
    return entry.isDirectory() ? filesIn(path) : [relative(site, path).replaceAll('\\', '/')];
  });
}

assert.deepEqual(filesIn(site).sort(), expected);
assert.equal(
  readFileSync(resolve(site, 'assets/engine.mjs'), 'utf8'),
  readFileSync(resolve(project, 'src/engine.mjs'), 'utf8'),
  'The published engine must match the tested source.',
);

const html = readFileSync(resolve(site, 'index.html'), 'utf8');
const canonical = '<link rel="canonical" href="https://huangwangwang0318-beep.github.io/jichanglab-airport-guide/">';
assert.match(html, /<title>[^<]*机场套餐成本计算器[^<]*<\/title>/);
assert.match(html, /<meta name="description" content="[^"]+">/);
assert.match(html, /<h1>机场套餐真实使用成本/);
assert.match(html, /href="\.\/assets\/site\.css"/);
assert.match(html, /src="\.\/assets\/app\.js"/);
assert.doesNotMatch(html, /noindex/i);
assert.equal(html.split(canonical).length, 2, 'The Pages demo must have exactly one self canonical URL.');
assert.match(readFileSync(resolve(site, 'assets/app.js'), 'utf8'), /from '\.\/engine\.mjs'/);

for (const file of expected) {
  const contents = readFileSync(resolve(site, file), 'utf8');
  assert.doesNotMatch(file === 'index.html' ? contents.replace(canonical, '') : contents, /https?:\/\/|\/\/[A-Za-z0-9.-]+\.[A-Za-z]{2,}/i, `${file} contains an external URL`);
  assert.doesNotMatch(contents, /\b(?:fetch|XMLHttpRequest|sendBeacon|WebSocket)\b/, `${file} contains a network API`);
}

for (const script of ['assets/app.js', 'assets/engine.mjs']) {
  execFileSync(process.execPath, ['--check', resolve(site, script)], {stdio: 'pipe'});
}

console.log(`Pages payload verified: ${expected.join(', ')}`);
