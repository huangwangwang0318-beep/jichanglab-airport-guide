import {copyFileSync, readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {resolve, dirname} from 'node:path';

const project = resolve(import.meta.dirname, '..');
const repo = resolve(project, '../..');
const site = resolve(project, 'site');
const commercial = resolve(repo, 'commercial-site');

copyFileSync(resolve(project, 'src/engine.mjs'), resolve(site, 'assets/engine.mjs'));
copyFileSync(resolve(commercial, 'assets/site.css'), resolve(site, 'assets/brand.css'));

const brandList = [
  ['liuliuyun', '六六云'],
  ['xingchen', '星辰VPN'],
  ['xiyouyun', '西游云'],
  ['shanshuiyun', '山水云'],
  ['mojie', '魔戒'],
  ['wangjikuache', '网际快车'],
  ['flybit', 'FlyBit'],
  ['chaoshihui', '超实惠加速'],
  ['wuguiyun', '乌龟云'],
  ['hongxingyun', '红杏云'],
];
const approved = JSON.parse(readFileSync(resolve(commercial, 'affiliate-links.json'), 'utf8'));
const origin = 'https://huangwangwang0318-beep.github.io/jichanglab-airport-guide/';
if (brandList.length !== 10 || Object.keys(approved).length !== 10) throw new Error('Brand whitelist must have exactly 10 entries.');

for (const [slug, name] of brandList) {
  const from = resolve(commercial, 'brands', slug, 'index.html');
  const target = resolve(site, 'brands', slug, 'index.html');
  let html = readFileSync(from, 'utf8');
  const canonical = origin + 'brands/' + slug + '/';
  if (!html.includes(approved[name])) throw new Error('Missing invitation URL for ' + name);
  if (!html.includes('href="../../assets/site.css"')) throw new Error('Unexpected brand stylesheet: ' + name);
  html = html.replace('href="../../assets/site.css"', 'href="../../assets/brand.css"');
  html = html.replace('</head>', '<link rel="canonical" href="' + canonical + '"></head>');
  mkdirSync(dirname(target), {recursive: true});
  writeFileSync(target, html, 'utf8');
}

const urls = [origin, ...brandList.map(([slug]) => origin + 'brands/' + slug + '/')];
const sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  urls.map(url => '<url><loc>' + url + '</loc></url>').join('\n') + '\n</urlset>\n';
writeFileSync(resolve(site, 'sitemap.xml'), sitemap, 'utf8');

console.log('Published payload prepared: original calculator, 10 brand guides, and 11-URL sitemap.');
