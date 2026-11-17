/**
 * Historical-price matching for the calculator's approximate cash spend.
 * No service quality ranking, no assumption that unknown terms are verified.
 * Results are informational internal links, never checkout redirects.
 */
export const BRAND_SLUGS = Object.freeze({
 '六六云':'liuliuyun','星辰VPN':'xingchen','西游云':'xiyouyun','山水云':'shanshuiyun',
 '魔戒':'mojie','网际快车':'wangjikuache','FlyBit':'flybit',
 '超实惠加速':'chaoshihui','乌龟云':'wuguiyun','红杏云':'hongxingyun'
});

const BILLING = Object.freeze({monthly:1,quarterly:3,semiannual:6,annual:12});
const round2 = n => Math.round((n + Number.EPSILON)*100)/100;

/**
 * Infer approximate historical spend only where the known billing schedule is
 * sufficient for a bounded calculation. "unknown" reset does not mean monthly reset.
 */
export function matchHistoricalBrands(plans, {months, usageGB, targetTotalYuan, maxResults=4}) {
  if (!Number.isInteger(months)||months<1||months>36||!Number.isFinite(usageGB)||usageGB<=0 ||
      !Number.isFinite(targetTotalYuan)||targetTotalYuan<=0 ||
      !Number.isInteger(maxResults)||maxResults<1||maxResults>10) {
    throw new RangeError('预算匹配条件不完整');
  }
  const eligible=[];
  for (const p of plans) {
    if(p.source_type!=='user_historical_summary'||!BRAND_SLUGS[p.provider] ||
      !(Number.isFinite(p.price_cny)&&p.price_cny>0) ||
      !(Number.isFinite(p.traffic_gb)&&p.traffic_gb>0)) continue;
    let projected=null, caveat='';
    if(Object.hasOwn(BILLING,p.billing_cycle)) {
      // Only use monthly examples whose nominal quota is at least monthly demand.
      // Reset rule unknown => do NOT describe these as proven sufficient plans.
      const cycle=BILLING[p.billing_cycle];
      if(p.traffic_gb+1e-8 < usageGB)continue;
      projected=p.price_cny*Math.ceil(months/cycle);
      caveat = p.traffic_reset_rule==='unknown' ?
        '仅根据历史报价及名义流量比较；实际重置规则和设备限制未知' :
        '实际设备、续费及在售条件仍需核实';
    } else if(p.billing_cycle==='one_time') {
      // We cannot project repeat purchases/expiry without verified validity.
      // In this data only one 365-day family has a bounded validity.
      if(!Number.isInteger(p.validity_days)||p.validity_days<30*months ||
         p.traffic_gb+1e-8 < usageGB*months)continue;
      projected=p.price_cny;
      caveat='固定总流量且有效期覆盖预计月份；同时在线设备与在售条款未知';
    } else continue;
    const amount=round2(projected);
    if(!Number.isFinite(amount)||amount<=0)continue;
    eligible.push({
      provider:p.provider,slug:BRAND_SLUGS[p.provider],planName:p.plan_name,
      approximateYuan:amount,months,withinReference:amount<=targetTotalYuan+0.005,
      budgetDifferenceYuan:round2(targetTotalYuan-amount),
      budgetDistancePercent:round2(Math.abs(targetTotalYuan-amount)/targetTotalYuan*100),
      caveat,sourceDate:p.observed_date
    });
  }
  // Rank by *this calculation's* target amount, not a fixed brand order.
  // A slightly over-budget option is shown explicitly as over-budget,
  // rather than silently replacing it with a much cheaper, unrelated one.
  const ranking=(a,b)=>{
    const distance=a.budgetDistancePercent-b.budgetDistancePercent;
    if(Math.abs(distance)>0.000001)return distance;
    if(a.withinReference!==b.withinReference)return a.withinReference?-1:1;
    return a.approximateYuan-b.approximateYuan||a.provider.localeCompare(b.provider,'zh-CN');
  };
  eligible.sort(ranking);
  const seen=new Set(), matches=[];
  for(const row of eligible){
    if(seen.has(row.provider))continue;
    seen.add(row.provider);matches.push(row);
    if(matches.length>=maxResults)break;
  }
  return matches;
}
