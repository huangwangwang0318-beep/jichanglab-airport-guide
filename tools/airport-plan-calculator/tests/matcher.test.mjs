import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {matchHistoricalBrands} from '../src/matcher.mjs';

const plans=JSON.parse(readFileSync(resolve(import.meta.dirname,'../../../data/plans.json'),'utf8'));
const query={months:12,usageGB:50,targetTotalYuan:120,maxResults:5};

test('12-month reference budget uses historical monthly spend and internal slugs',()=>{
 const m=matchHistoricalBrands(plans,query);
 assert.ok(m.length>=2);
 assert.equal(m[0].provider,'星辰VPN');
 assert.equal(m[0].approximateYuan,118.8);
 assert.equal(m[0].slug,'xingchen');
 assert.ok(m.every(x=>x.withinReference));
 assert.ok(m.every(x=>typeof x.slug==='string'&&x.slug.length>2));
});
test('unknown one-time validity cannot produce an invented 12-month cost',()=>{
 const m=matchHistoricalBrands(plans,{...query,targetTotalYuan:500,maxResults:10});
 assert.ok(!m.some(x=>x.provider==='魔戒'||x.provider==='网际快车'));
});
test('fixed pool over a year must cover entire total usage and validity',()=>{
 const m=matchHistoricalBrands(plans,{months:12,usageGB:10,targetTotalYuan:60,maxResults:10});
 assert.ok(m.some(x=>x.provider==='山水云'));
 const large=matchHistoricalBrands(plans,{...query,targetTotalYuan:500,maxResults:10});
 assert.ok(!large.some(x=>x.provider==='山水云'));
});
test('unverified providers never gain fabricated prices',()=>{
 const m=matchHistoricalBrands(plans,{months:1,usageGB:20,targetTotalYuan:999,maxResults:10});
 for(const n of ['FlyBit','超实惠加速','乌龟云','红杏云'])
  assert.ok(!m.some(x=>x.provider===n));
});
test('over-budget options are labeled, not silently called affordable',()=>{
 const m=matchHistoricalBrands(plans,{months:12,usageGB:50,targetTotalYuan:10,maxResults:3});
 assert.ok(m.length>=1);
 assert.ok(m.every(x=>!x.withinReference));
});
test('invalid references reject rather than create misleading recommendations',()=>{
 assert.throws(()=>matchHistoricalBrands(plans,{months:0,usageGB:50,targetTotalYuan:100}),RangeError);
 assert.throws(()=>matchHistoricalBrands(plans,{months:12,usageGB:0,targetTotalYuan:100}),RangeError);
});
