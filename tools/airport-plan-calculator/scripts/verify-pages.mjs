import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {resolve, relative} from 'node:path';
import {execFileSync} from 'node:child_process';

const project = resolve(import.meta.dirname, '..');
const repoRoot = resolve(project, '../..');
const site = resolve(project, 'site');
const base = 'https://huangwangwang0318-beep.github.io/jichanglab-airport-guide/';
const names = ['liuliuyun','xingchen','xiyouyun','shanshuiyun','mojie','wangjikuache','flybit','chaoshihui','wuguiyun','hongxingyun'];
const allowed = new Set(Object.values(JSON.parse(readFileSync(resolve(repoRoot,'commercial-site/affiliate-links.json'),'utf8'))));
assert.equal(allowed.size, 10, 'Exactly ten approved external invitation targets are required.');

const expected = [
  'assets/app.js','assets/brand.css','assets/engine.mjs','assets/matcher.mjs','assets/plan-data.mjs','assets/site.css','index.html','sitemap.xml',
  ...names.map(slug => 'brands/' + slug + '/index.html')
];
function fileList(dir) {
  return readdirSync(dir, {withFileTypes:true}).flatMap(entry => {
    const path = resolve(dir, entry.name);
    assert.ok(!entry.isSymbolicLink(), 'Symlink not allowed in published Pages payload: ' + path);
    return entry.isDirectory() ? fileList(path) : [relative(site,path).replaceAll('\\\\','/')];
  });
}
assert.deepEqual(fileList(site).sort(), expected.sort(), 'Unexpected or missing Pages files.');
assert.equal(readFileSync(resolve(site,'assets/engine.mjs'),'utf8'), readFileSync(resolve(project,'src/engine.mjs'),'utf8'));
assert.equal(readFileSync(resolve(site,'assets/matcher.mjs'),'utf8'),
  readFileSync(resolve(project,'src/matcher.mjs'),'utf8'),'Matcher published source must match tested source.');
const planData=readFileSync(resolve(site,'assets/plan-data.mjs'),'utf8');
for(const name of ['六六云','星辰VPN','西游云','山水云','魔戒','网际快车','FlyBit','超实惠加速','乌龟云','红杏云']){
  assert.ok(planData.includes(name),'Missing brand historical data: '+name);
}

const home = readFileSync(resolve(site,'index.html'),'utf8');
assert.ok(home.includes('name="google-site-verification"'), 'Google verification must remain.');
assert.ok(home.includes('name="msvalidate.01"'), 'Bing verification must remain.');
assert.ok(home.includes('id="brands"'), 'Brand directory is missing from homepage.');
assert.ok(home.includes('id="budget-match"'), 'Cost-to-brand matching panel missing.');
assert.ok(home.includes('id="match-list"'), 'Matching output container missing.');
assert.ok(home.includes('<link rel="canonical" href="' + base + '">'), 'Homepage canonical mismatch.');
assert.ok(!home.includes('本工具没有推广邀请链接'), 'Obsolete no-affiliate statement found.');
const xml = readFileSync(resolve(site, 'sitemap.xml'),'utf8');
const locations = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
assert.deepEqual(locations, [base, ...names.map(n => base + 'brands/' + n + '/')]);

const outbound = new Set();
for (const page of expected.filter(name=>name.endsWith('.html'))) {
  const html=readFileSync(resolve(site,page),'utf8');
  assert.equal((html.match(/<h1\b/g)||[]).length,1,'Exactly one H1 on '+page);
  assert.ok(!html.includes('noindex'),'Unindexable: '+page);
  const canonical=base+(page==='index.html'?'':page.replace(/index\.html$/,''));
  assert.ok(html.includes('<link rel="canonical" href="'+canonical+'">'),'Bad canonical: '+page);
  const links=[...html.matchAll(/<a\b[^>]*href="(https?:\/\/[^"]+)"[^>]*>/g)];
  for(const match of links) {
    assert.ok(allowed.has(match[1]),'Unapproved clickable external URL in '+page+': '+match[1]);
    assert.ok(match[0].includes('sponsored'),'Missing affiliate disclosure rel in '+page);
    outbound.add(match[1]);
  }
  const remoteResources=[...html.matchAll(/<script\b[^>]*\bsrc="https?:\/\/[^"]+"|<img\b[^>]*\bsrc="https?:\/\/[^"]+"|<link\b[^>]*\brel="stylesheet"[^>]*\bhref="https?:\/\/[^"]+"/g)];
  assert.equal(remoteResources.length,0,'External scripts, images and stylesheets are forbidden: '+page);
}
assert.deepEqual(outbound, allowed, 'Missing or unexpected commission target.');

for(const file of ['assets/app.js','assets/engine.mjs','assets/matcher.mjs','assets/plan-data.mjs','assets/site.css','assets/brand.css']){
  const content=readFileSync(resolve(site,file),'utf8');
  assert.ok(!/\b(?:fetch|XMLHttpRequest|sendBeacon|WebSocket)\b/.test(content),file+' tries to access a network API');
}
for(const file of ['assets/app.js','assets/engine.mjs','assets/matcher.mjs','assets/plan-data.mjs'])
  execFileSync(process.execPath,['--check',resolve(site,file)],{stdio:'pipe'});
assert.ok(readFileSync(resolve(site,'assets/app.js'),'utf8').includes("'./matcher.mjs'"));
assert.ok(readFileSync(resolve(site,'assets/app.js'),'utf8').includes("link.href='./brands/'"));
console.log('Pages verified: calculator-to-brand internal links, 11 indexable HTML pages, 10 commission URLs, webmaster tags and sitemap.');
