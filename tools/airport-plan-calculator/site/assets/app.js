import { comparePlans } from './engine.mjs';
const form=document.getElementById('calc-form');
const error=document.getElementById('form-error');
const defaults={months:'12',usageGB:'50',devices:'1',a_price:'12',a_type:'monthly',a_quotaGB:'100',a_quotaMode:'monthly',a_validityMonths:'2',a_trafficFactor:'1',a_deviceLimit:'3',b_price:'120',b_type:'annual',b_quotaGB:'100',b_quotaMode:'monthly',b_validityMonths:'2',b_trafficFactor:'1',b_deviceLimit:'3'};
const currency=(x)=>'¥'+Number(x).toFixed(2);
const gb=(x)=>Number(x).toLocaleString('zh-CN',{maximumFractionDigits:2})+' GB';
function fields(){return Object.fromEntries(new FormData(form).entries());}
function plan(d,key){return {type:d[key+'_type'], price:d[key+'_price'],quotaGB:d[key+'_quotaGB'],quotaMode:d[key+'_quotaMode'],validityMonths:d[key+'_validityMonths'],trafficFactor:d[key+'_trafficFactor'],deviceLimit:d[key+'_deviceLimit']};}
function adjust(){
 for(const key of ['a','b']){
  const type=form.elements.namedItem(key+'_type').value;
  form.querySelector(`[data-reset="${key}"]`).hidden = type==='one_time';
  form.querySelector(`[data-validity="${key}"]`).hidden = type!=='one_time';
 }
}
const write=(id,t)=>{document.getElementById(id).textContent=t;};
function show(key,res){
  const status = res.verificationStatus === 'not_suitable' ? '有条件未满足'
    : res.verificationStatus === 'needs_verification' ? '关键条款待核实'
    : '符合输入条件';
  write(key+'-status',status);
  document.getElementById(key+'-status').classList.toggle('bad',!res.viable);
  write(key+'-total',currency(res.totalYuan));
  write(key+'-pays',String(res.payments)+' 次');
  write(key+'-monthly',currency(res.monthlyCashYuan));
  write(key+'-nominal',res.nominalPerPurchasedGB===null?'待核实':currency(res.nominalPerPurchasedGB)+'/GB');
  write(key+'-pergb',res.effectivePerActualGB===null?'不适用':currency(res.effectivePerActualGB)+'/GB');
  write(key+'-idle',res.idlePaidMonths+' 个月');
  write(key+'-billed',gb(res.billedGB));
}
function calc(){
  try{
   const d=fields(); const sc={months:d.months,usageGB:d.usageGB,devices:d.devices};
   const res=comparePlans(plan(d,'a'),plan(d,'b'),sc);
   show('a',res.A);show('b',res.B); write('verdict',res.verdict);error.textContent='';
   const node=document.getElementById('warnings');node.replaceChildren();
   for(const [name,r] of [['A',res.A],['B',res.B]]){
    if(r.reason){const p=document.createElement('p');p.textContent=`方案 ${name}：${r.reason}`;node.append(p)}
    for(const warn of r.warnings){const p=document.createElement('p');p.textContent=`方案 ${name}：${warn}`;node.append(p)}
   }
  }catch(e){error.textContent=e instanceof RangeError?e.message:'输入有误，请检查套餐条件';write('verdict','请输入有效条件后重新计算。');for(const key of ['a','b']){for(const id of ['total','pays','monthly','nominal','pergb','idle','billed'])write(key+'-'+id,'—');write(key+'-status','待更正输入');}document.getElementById('warnings').replaceChildren();}
}
const oneTimeExample={...defaults,months:'3',a_price:'8',a_type:'one_time',a_quotaGB:'60',a_validityMonths:'2',b_price:'12',b_type:'monthly'};
function fill(map){for(const [key,value] of Object.entries(map)){const el=form.elements.namedItem(key);if(el)el.value=value;}adjust();calc();}
form.addEventListener('submit',e=>{e.preventDefault();calc();document.getElementById('result-heading').scrollIntoView({block:'nearest',behavior:'smooth'});});
form.addEventListener('input',calc);form.addEventListener('change',()=>{adjust();calc()});
document.getElementById('reset-btn').addEventListener('click',()=>fill(defaults));
document.getElementById('example-btn').addEventListener('click',()=>fill(oneTimeExample));
adjust();calc();
