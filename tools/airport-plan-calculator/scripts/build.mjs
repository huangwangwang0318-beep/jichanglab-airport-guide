import {copyFileSync, readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {resolve, dirname} from 'node:path';

const project = resolve(import.meta.dirname, '..');
const repo = resolve(project, '../..');
const site = resolve(project, 'site');
const commercial = resolve(repo, 'commercial-site');

copyFileSync(resolve(project, 'src/engine.mjs'), resolve(site, 'assets/engine.mjs'));
copyFileSync(resolve(project, 'src/matcher.mjs'), resolve(site, 'assets/matcher.mjs'));
const historicalPlans = JSON.parse(readFileSync(resolve(repo, 'data/plans.json'),'utf8'));
writeFileSync(resolve(site,'assets/plan-data.mjs'),
  '// Generated from repository historical data by scripts/build.mjs. No network requests.\n' +
  'export const historicalPlans = Object.freeze(' + JSON.stringify(historicalPlans) + ');\n',
  'utf8');

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

// Meaningful adjacent guides. These are plain internal links, not ranking claims.
// Generated only for the Pages version; the commercial source pages remain untouched.
const relatedGuides = {
  liuliuyun: [['xingchen','星辰VPN月付80–200GB档'],['xiyouyun','西游云120–500GB月付档']],
  xingchen: [['liuliuyun','六六云月付与一次性差异'],['xiyouyun','西游云多档月付对比']],
  xiyouyun: [['xingchen','星辰VPN的80／100／200GB方案'],['liuliuyun','六六云的大流量历史方案']],
  shanshuiyun: [['wangjikuache','网际快车一次性20GB'],['mojie','魔戒一次性130GB起']],
  mojie: [['shanshuiyun','山水云365天固定总量'],['wangjikuache','网际快车一次性20GB']],
  wangjikuache: [['shanshuiyun','山水云全年固定总流量'],['mojie','魔戒多档一次性流量']],
  flybit: [['chaoshihui','超实惠加速的续费核对'],['wuguiyun','乌龟云设备使用条件']],
  chaoshihui: [['flybit','FlyBit的付款条件'],['hongxingyun','红杏云的到期与续费规则']],
  wuguiyun: [['hongxingyun','红杏云的流量计费规则'],['flybit','FlyBit的套餐确认清单']],
  hongxingyun: [['wuguiyun','乌龟云设备与流量条件'],['chaoshihui','超实惠加速续费核对']]
};

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
  // The Pages calculator uses #tool and #method; the standalone commercial
  // source site uses #calc and #guide. Rewrite only in the Pages build.
  if (!html.includes('../../index.html#calc') || !html.includes('../../index.html#guide')) {
    throw new Error('Expected source navigation anchors missing for ' + name);
  }
  html = html.replaceAll('../../index.html#calc', '../../index.html#tool');
  html = html.replaceAll('../../index.html#guide', '../../index.html#method');
  const comparisons = relatedGuides[slug];
  if (!Array.isArray(comparisons) || comparisons.length !== 2) {
    throw new Error('Missing two comparable brand guides for ' + slug);
  }
  const comparisonLinks = comparisons.map(([otherSlug, text]) => {
    if (!brandList.some(([existingSlug]) => existingSlug === otherSlug) || otherSlug === slug) {
      throw new Error('Bad related brand internal link: ' + slug + ' => ' + otherSlug);
    }
    return '<a class="button alt" href="../' + otherSlug + '/">' + text + ' →</a>';
  }).join(' ');
  const comparisonSection =
    '<section class="section"><div class="wrap"><article class="panel">' +
    '<h2>继续比较类似的计费选择</h2>' +
    '<p>以下为站内相关资料，不是网络质量排名或实时售价推荐。可以对照不同的付款周期、额度和已核实条件，再自行决定。</p>' +
    '<div class="actions">' + comparisonLinks + '</div></article></div></section>';
  if (!html.includes('</main>')) throw new Error('Missing main closing tag: ' + slug);
  html = html.replace('</main>', comparisonSection + '</main>');

  html = html.replace('</head>', '<link rel="canonical" href="' + canonical + '"></head>');
  mkdirSync(dirname(target), {recursive: true});
  writeFileSync(target, html, 'utf8');
}

const urls = [origin, ...brandList.map(([slug]) => origin + 'brands/' + slug + '/')];
const sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  urls.map(url => '<url><loc>' + url + '</loc></url>').join('\n') + '\n</urlset>\n';
writeFileSync(resolve(site, 'sitemap.xml'), sitemap, 'utf8');

console.log('Published payload prepared: original calculator, 10 brand guides, and 11-URL sitemap.');
