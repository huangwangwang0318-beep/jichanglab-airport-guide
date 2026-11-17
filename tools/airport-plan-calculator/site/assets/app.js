import { comparePlans } from './engine.mjs';
import { matchHistoricalBrands, selectMatchingBudget } from './matcher.mjs';
import { historicalPlans } from './plan-data.mjs';
const form=document.getElementById('calc-form');
const matchSource=document.getElementById('match-source');
const manualBudget=document.getElementById('manual-budget');
const manualBudgetLabel=document.getElementById('manual-budget-label');
let lastEditedPlan=null;
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
function renderMatches(res,scenario){
  const list=document.getElementById('match-list');
  const summary=document.getElementById('match-summary');
  list.replaceChildren();
  const selected=selectMatchingBudget(res,{
    mode:matchSource.value,lastEditedPlan,manualAmount:manualBudget.value
  });
  if(selected.value===null){
    summary.textContent=selected.reason||'请调整预算后重新匹配';
    return;
  }
  const reference=selected.value;
  const matches=matchHistoricalBrands(historicalPlans,{
    months:Number(scenario.months),usageGB:Number(scenario.usageGB),
    targetTotalYuan:reference,maxResults:5
  });
  summary.textContent='这次按 '+selected.label+' '+currency(reference)+
    ' 重新筛选；匹配顺序与预算差额会随计算金额、使用月份或流量变化。';
  if(!matches.length){
    const p=document.createElement('p');
    p.textContent='没有能根据现有历史资料估算的品牌；可从下方全部10家品牌中核对实时套餐。';
    list.append(p);return;
  }
  for(const m of matches){
    const card=document.createElement('article');card.className='match-card';
    const header=document.createElement('div');header.className='match-card-head';
    const title=document.createElement('strong');title.textContent=m.provider;
    const tag=document.createElement('span');tag.className='match-badge';
    tag.textContent=m.withinReference?'历史估算不超预算':'历史估算超出预算';
    header.append(title,tag);
    const amount=document.createElement('div');amount.className='match-amount';
    amount.textContent=currency(m.approximateYuan)+' / '+m.months+'个月历史估算';
    const delta=document.createElement('div');delta.className='match-diff';
    delta.textContent=(m.withinReference?'比当前预算少 ':'比当前预算多 ')+currency(Math.abs(m.budgetDifferenceCents)/100);
    const desc=document.createElement('p');desc.className='match-description';
    desc.textContent=m.planName+' · '+m.caveat+'。资料日期：'+m.sourceDate;
    const link=document.createElement('a');link.className='match-link';
    link.href='./brands/'+m.slug+'/';link.textContent='查看'+m.provider+'详情 →';
    card.append(header,amount,delta,desc,link);
    list.append(card);
  }
}
function clearMatches(){
  document.getElementById('match-list').replaceChildren();
  document.getElementById('match-summary').textContent='请更正输入后重新计算，再查看对应品牌栏目。';
}
function calc(){
  try{
   const d=fields(); const sc={months:d.months,usageGB:d.usageGB,devices:d.devices};
   const res=comparePlans(plan(d,'a'),plan(d,'b'),sc);
   show('a',res.A);show('b',res.B); write('verdict',res.verdict);error.textContent='';
   renderMatches(res,sc);
   const node=document.getElementById('warnings');node.replaceChildren();
   for(const [name,r] of [['A',res.A],['B',res.B]]){
    if(r.reason){const p=document.createElement('p');p.textContent=`方案 ${name}：${r.reason}`;node.append(p)}
    for(const warn of r.warnings){const p=document.createElement('p');p.textContent=`方案 ${name}：${warn}`;node.append(p)}
   }
  }catch(e){error.textContent=e instanceof RangeError?e.message:'输入有误，请检查套餐条件';write('verdict','请输入有效条件后重新计算。');for(const key of ['a','b']){for(const id of ['total','pays','monthly','nominal','pergb','idle','billed'])write(key+'-'+id,'—');write(key+'-status','待更正输入');}document.getElementById('warnings').replaceChildren();clearMatches();}
}
const oneTimeExample={...defaults,months:'3',a_price:'8',a_type:'one_time',a_quotaGB:'60',a_validityMonths:'2',b_price:'12',b_type:'monthly'};
function fill(map){for(const [key,value] of Object.entries(map)){const el=form.elements.namedItem(key);if(el)el.value=value;}adjust();calc();}
form.addEventListener('submit',e=>{e.preventDefault();calc();document.getElementById('result-heading').scrollIntoView({block:'nearest',behavior:'smooth'});});
form.addEventListener('input',e=>{
 const name=e.target?.name||'';
 if(name.startsWith('a_'))lastEditedPlan='a';
 else if(name.startsWith('b_'))lastEditedPlan='b';
 calc();
});
form.addEventListener('change',e=>{
 const name=e.target?.name||'';
 if(name.startsWith('a_'))lastEditedPlan='a';
 else if(name.startsWith('b_'))lastEditedPlan='b';
 adjust();calc();
});
matchSource.addEventListener('change',()=>{
 manualBudgetLabel.hidden=matchSource.value!=='manual';
 calc();
});
manualBudget.addEventListener('input',()=>{if(matchSource.value==='manual')calc()});
document.getElementById('reset-btn').addEventListener('click',()=>{
 lastEditedPlan=null;matchSource.value='auto';manualBudget.value='120';manualBudgetLabel.hidden=true;
 fill(defaults);
});
document.getElementById('example-btn').addEventListener('click',()=>{lastEditedPlan=null;fill(oneTimeExample)});
adjust();calc();
