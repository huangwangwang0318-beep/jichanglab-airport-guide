import test from 'node:test';
import assert from 'node:assert/strict';
import {calculatePlan,comparePlans} from '../src/engine.mjs';
const scenario = {months:12, usageGB:50, devices:1};
const month = {type:'monthly',price:12,quotaGB:100,quotaMode:'monthly',trafficFactor:1,deviceLimit:3};
const annual = {type:'annual',price:120,quotaGB:100,quotaMode:'monthly',trafficFactor:1,deviceLimit:3};
test('12-month example computes 144 vs 120',()=>{
  const r=comparePlans(month,annual,scenario);
  assert.equal(r.A.totalYuan,144); assert.equal(r.B.totalYuan,120);
  assert.match(r.verdict,/¥24\.00/);
});
test('3-month annual cost is full prepayment not prorated',()=>{
 const r=comparePlans(month,annual,{...scenario,months:3});
 assert.equal(r.A.totalYuan,36); assert.equal(r.B.totalYuan,120); assert.equal(r.B.idlePaidMonths,9);
});
test('quarterly pool checks active months only and prepaid end',()=>{
 const p={type:'quarterly',price:20,quotaGB:160,quotaMode:'period',trafficFactor:1,deviceLimit:null};
 const r=calculatePlan(p,{...scenario,months:4});
 assert.equal(r.payments,2); assert.equal(r.totalYuan,40); assert.equal(r.idlePaidMonths,2);assert.equal(r.viable,true);
});
test('quarterly quota insufficient flags model as unfit',()=>{
 const p={type:'quarterly',price:20,quotaGB:120,quotaMode:'period',trafficFactor:1};
 assert.equal(calculatePlan(p,{...scenario,months:4}).viable,false);
});
test('monthly reset with traffic factor 2 exceeds allowance',()=>{
 const r=calculatePlan({...month,trafficFactor:2,quotaGB:80},scenario);
 assert.equal(r.viable,false);assert.equal(r.billedGB,1200);
});
test('onetime renewal windows account for expiry and packs',()=>{
 const p={type:'one_time',price:8,quotaGB:60,validityMonths:2,trafficFactor:1,deviceLimit:2};
 const r=calculatePlan(p,{months:3,usageGB:50,devices:1});
 assert.equal(r.payments,3);assert.equal(r.totalYuan,24);assert.equal(r.unusedQuotaGB,30);
});
test('onetime validity one month with 2x multiplier and two packs per month',()=>{
 const p={type:'one_time',price:9.9,quotaGB:60,validityMonths:1,trafficFactor:2};
 const r=calculatePlan(p,{months:2,usageGB:50,devices:1});
 assert.equal(r.payments,4);assert.equal(r.totalYuan,39.6);
});
test('device limit rejects plan',()=>{
 const r=calculatePlan({...month,deviceLimit:1},{...scenario,devices:2});assert.equal(r.viable,false);
});
test('decimal currency and total cents remain exact',()=>{
 const r=calculatePlan({...month,price:6.99},{...scenario,months:3});
 assert.equal(r.totalCents,2097);assert.equal(r.totalYuan,20.97);
});
test('invalid price precision rejects',()=>{
 assert.throws(()=>calculatePlan({...month,price:12.345},scenario),RangeError);
});
test('invalid billing mode rejects',()=>{
 assert.throws(()=>calculatePlan({...month,quotaMode:'no'},scenario),RangeError);
});
test('unknown device limit is warning not fabricated approval',()=>{
 const r=calculatePlan({...month,deviceLimit:null},scenario);
 assert.match(r.warnings[0],/未知/);
});
test('boundary handling with equality meets quota',()=>{
 assert.equal(calculatePlan({...month,quotaGB:100,trafficFactor:2},scenario).viable,true);
});
test('no fabricated winner when both insufficient',()=>{
 const result=comparePlans({...month,quotaGB:5},{...annual,quotaGB:5},scenario);
 assert.match(result.verdict,/都不满足/);
});

test('unknown device limit does not assert confirmed suitability',()=>{
 const r=calculatePlan({...month,deviceLimit:null},scenario);
 assert.equal(r.verificationStatus,'needs_verification');
 const c=comparePlans({...month,deviceLimit:null},annual,scenario);
 assert.match(c.verdict,/暂不作最终选购结论/);
});
test('known device limit marks plan as consistent with entered conditions',()=>{
 const r=calculatePlan(month,scenario);
 assert.equal(r.verificationStatus,'fits_entered_conditions');
});
test('nominal purchased quota and actual usage have distinct unit costs',()=>{
 const r=calculatePlan(annual,{...scenario,months:3});
 assert.equal(r.purchasedQuotaGB,1200);
 assert.equal(r.nominalPerPurchasedGB,0.1);
 assert.equal(r.effectivePerActualGB,0.8);
});
test('one-time nominal cost includes all purchased packs',()=>{
 const r=calculatePlan({type:'one_time',price:8,quotaGB:60,validityMonths:2,trafficFactor:1,deviceLimit:2},{months:3,usageGB:50,devices:1});
 assert.equal(r.purchasedQuotaGB,180);
 assert.equal(r.nominalPerPurchasedGB,0.13);
 assert.equal(r.effectivePerActualGB,0.16);
});
test('unknown reset is not declared suitable and has no inferred quota cost',()=>{
 const p={...annual,quotaMode:'unknown'};
 const r=calculatePlan(p,scenario);
 assert.equal(r.totalYuan,120);
 assert.equal(r.verificationStatus,'needs_verification');
 assert.equal(r.nominalPerPurchasedGB,null);
 assert.equal(r.effectivePerActualGB,null);
 assert.equal(r.unusedQuotaGB,null);
 assert.match(comparePlans(p,month,scenario).verdict,/暂不作最终选购结论/);
});
test('semiannual prepayment and fixed pool are calculated by whole cycles',()=>{
 const p={type:'semiannual',price:49.99,quotaGB:300,quotaMode:'period',trafficFactor:1,deviceLimit:3};
 const r=calculatePlan(p,{months:7,usageGB:40,devices:1});
 assert.equal(r.payments,2); assert.equal(r.totalYuan,99.98); assert.equal(r.idlePaidMonths,5);
 assert.equal(r.purchasedQuotaGB,600);
});
test('missing validity and invalid traffic or usage are rejected',()=>{
 const one={type:'one_time',price:8,quotaGB:60,trafficFactor:1,deviceLimit:2};
 assert.throws(()=>calculatePlan(one,scenario),RangeError);
 assert.throws(()=>calculatePlan({...month,trafficFactor:-1},scenario),RangeError);
 assert.throws(()=>calculatePlan(month,{...scenario,usageGB:0}),RangeError);
 assert.throws(()=>calculatePlan(month,{...scenario,usageGB:50001}),RangeError);
});
