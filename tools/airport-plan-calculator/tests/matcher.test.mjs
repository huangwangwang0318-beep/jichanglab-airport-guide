import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {matchHistoricalBrands,selectMatchingBudget} from '../src/matcher.mjs';

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

test('changing computed total from 120 to 190 to 450 changes first matched brand',()=>{
 const a=matchHistoricalBrands(plans,{...query,targetTotalYuan:120,maxResults:4});
 const b=matchHistoricalBrands(plans,{...query,targetTotalYuan:190,maxResults:4});
 const c=matchHistoricalBrands(plans,{...query,targetTotalYuan:450,maxResults:4});
 assert.equal(a[0].provider,'星辰VPN');
 assert.equal(b[0].provider,'西游云');
 assert.equal(c[0].provider,'西游云');
 assert.equal(b[0].approximateYuan,192);
 assert.equal(c[0].approximateYuan,456);
 assert.equal(b[0].budgetDifferenceYuan,-2);
 assert.equal(c[0].budgetDifferenceYuan,-6);
 assert.notDeepEqual(a.map(x=>x.approximateYuan),b.map(x=>x.approximateYuan));
});
test('even when a brand stays matched, budget gap changes with every price change',()=>{
 const a=matchHistoricalBrands(plans,{...query,targetTotalYuan:120})[0];
 const b=matchHistoricalBrands(plans,{...query,targetTotalYuan:121})[0];
 assert.equal(a.provider,b.provider);
 assert.equal(b.budgetDifferenceYuan-a.budgetDifferenceYuan,1);
});
test('changing usage months recalculates provider total rather than fixing a quote',()=>{
 const a=matchHistoricalBrands(plans,{months:3,usageGB:50,targetTotalYuan:30,maxResults:5});
 const b=matchHistoricalBrands(plans,{months:12,usageGB:50,targetTotalYuan:120,maxResults:5});
 const x=a.find(p=>p.provider==='星辰VPN'), y=b.find(p=>p.provider==='星辰VPN');
 assert.equal(x.approximateYuan,29.7);
 assert.equal(y.approximateYuan,118.8);
});
test('auto matching follows most recently edited A or B, not always lower B',()=>{
 const result={A:{viable:true,totalYuan:180},B:{viable:true,totalYuan:120}};
 assert.equal(selectMatchingBudget(result).value,120);
 assert.equal(selectMatchingBudget(result,{mode:'auto',lastEditedPlan:'a'}).value,180);
 assert.equal(selectMatchingBudget(result,{mode:'auto',lastEditedPlan:'b'}).value,120);
 assert.equal(selectMatchingBudget(result,{mode:'a'}).value,180);
 assert.equal(selectMatchingBudget(result,{mode:'lower'}).value,120);
 assert.equal(selectMatchingBudget(result,{mode:'manual',manualAmount:'88.50'}).value,88.5);
 assert.equal(selectMatchingBudget(result,{mode:'manual',manualAmount:''}).value,null);
});
test('a selected invalid plan should not produce a false affordable recommendation',()=>{
 const result={A:{viable:false,totalYuan:1},B:{viable:true,totalYuan:120}};
 assert.equal(selectMatchingBudget(result,{mode:'a'}).value,null);
 assert.equal(selectMatchingBudget(result,{mode:'auto',lastEditedPlan:'a'}).value,null);
 assert.equal(selectMatchingBudget(result,{mode:'lower'}).value,120);
});
