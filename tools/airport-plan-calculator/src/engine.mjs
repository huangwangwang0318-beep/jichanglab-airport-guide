/**
 * Airport Plan Calculator - deterministic, dependency-free estimate engine.
 * All prices are converted to integer cents. It never makes network requests.
 * Scenarios are MONTH-BASED estimates, not real billing-calendar predictions.
 */
export const BILLING_MONTHS = Object.freeze({ monthly:1, quarterly:3, semiannual:6, annual:12 });
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const fail = (message) => { throw new RangeError(message); };
const num = (x, field, min, max) => {
  const v = Number(x);
  if (x === '' || x === null || x === undefined || !Number.isFinite(v) || v < min || v > max) fail(`${field} 必须在 ${min}–${max} 之间`);
  return v;
};
const integer = (x, field, min, max) => {
  const v = num(x, field, min, max);
  if (!Number.isInteger(v)) fail(`${field} 必须是整数`);
  return v;
};
const cents = (x) => {
  const n = num(x, '套餐单次付款金额', 0.01, 1000000);
  if (Math.abs(n * 100 - Math.round(n * 100)) > 1e-7) fail('付款金额最多只能有两位小数');
  return Math.round(n * 100);
};

/** Plan:
 * type: 'monthly'|'quarterly'|'semiannual'|'annual'|'one_time'
 * quotaMode: 'monthly', 'period', or 'unknown' for recurring plans; one_time is always fixed quota
 * validityMonths: REQUIRED for one_time (integer, modeling months)
 * quotaGB: positive limit per reset or package; trafficFactor: billed GB per used GB
 * deviceLimit: optional integer (null means unknown), not treated as verified
 */
export function calculatePlan(plan, scenario) {
  const months = integer(scenario.months, '预计使用月数', 1, 36);
  const usedMonthly = num(scenario.usageGB, '预计每月实际使用流量', 0.01, 50000);
  const requiredDevices = integer(scenario.devices, '需要同时使用的设备数', 1, 50);
  const type = plan.type;
  if (type !== 'one_time' && !Object.hasOwn(BILLING_MONTHS, type)) fail('未知付费周期');
  const priceCents = cents(plan.price);
  const quota = num(plan.quotaGB, '套餐流量额度', 0.01, 500000);
  const factor = num(plan.trafficFactor, '流量计费倍率', 0.1, 20);
  const limit = (plan.deviceLimit === '' || plan.deviceLimit === null || plan.deviceLimit === undefined)
    ? null : integer(plan.deviceLimit, '设备限制', 1, 999);
  const billedMonthly = usedMonthly * factor;
  const usedTotal = usedMonthly * months;
  const billedTotal = billedMonthly * months;
  let payments = 0;
  let paidMonths = months;
  let idlePaidMonths = 0;
  let unusedQuota = 0;
  let quotaEnough = true;
  let quotaVerified = true;
  let reason = '';
  let cycleMonths = null;
  let validityMonths = null;
  if (type === 'one_time') {
    validityMonths = integer(plan.validityMonths, '一次性套餐有效期（月）', 1, 36);
    // Multiple packs per validity window assumed allowed. No carrying expired unused quota.
    for (let start = 0; start < months; start += validityMonths) {
      const activeMonths = Math.min(validityMonths, months - start);
      const billedInWindow = activeMonths * billedMonthly;
      const neededPacks = Math.ceil((billedInWindow / quota) - 1e-10);
      payments += Math.max(1, neededPacks);
      unusedQuota += Math.max(0, neededPacks * quota - billedInWindow);
    }
  } else {
    cycleMonths = BILLING_MONTHS[type];
    const mode = plan.quotaMode;
    if (mode !== 'monthly' && mode !== 'period' && mode !== 'unknown') fail('请选择正确的流量重置规则');
    payments = Math.ceil(months / cycleMonths);
    paidMonths = payments * cycleMonths;
    idlePaidMonths = paidMonths - months;
    if (mode === 'unknown') {
      quotaVerified = false;
    } else if (mode === 'monthly') {
      quotaEnough = billedMonthly <= quota + 1e-8;
      unusedQuota = Math.max(0, months * (quota - billedMonthly));
      if (!quotaEnough) reason = `每月计费流量 ${round2(billedMonthly)} GB 超过每月额度 ${round2(quota)} GB`;
    } else {
      for (let start = 0; start < months; start += cycleMonths) {
        const activeMonths = Math.min(cycleMonths, months - start);
        const billedInPeriod = billedMonthly * activeMonths;
        if (billedInPeriod > quota + 1e-8) quotaEnough = false;
        unusedQuota += Math.max(0, quota - billedInPeriod);
      }
      if (!quotaEnough) reason = `至少一个付费周期内的计费流量超过 ${round2(quota)} GB 的固定额度`;
    }
  }
  const devicesEnough = limit === null || limit >= requiredDevices;
  if (!devicesEnough) reason = [reason, `仅允许 ${limit} 台设备，低于需求的 ${requiredDevices} 台`].filter(Boolean).join('；');
  const viable = quotaEnough && devicesEnough;
  const totalCents = priceCents * payments;
  if (!Number.isSafeInteger(totalCents)) fail('总金额超过安全计算范围');
  const purchasedQuotaGB = !quotaVerified ? null : type === 'one_time' || plan.quotaMode === 'period'
    ? payments * quota : paidMonths * quota;
  const warnings = [];
  if (limit === null) warnings.push('设备数量上限未知，需在商家结算页确认');
  if (!quotaVerified) warnings.push('流量重置规则未知，无法确认额度是否满足需求或计算名义单位流量成本');
  if (type === 'one_time') warnings.push('一次性套餐按有效期分窗估算，假设允许重复购买；不推断自动续购、退款或流量跨期结转');
  if (idlePaidMonths > 0) warnings.push(`最后一个付款周期可能含 ${idlePaidMonths} 个未使用的预付月份`);
  if (!quotaEnough) warnings.push('当前模型不自动购买额外流量，也不假设超额可继续使用');
  return {
    viable, reason, months, payments, priceCents, totalCents, totalYuan: round2(totalCents / 100),
    monthlyCashYuan: round2(totalCents / 100 / months),
    actualGB: round2(usedTotal), billedGB: round2(billedTotal),
    nominalPerPurchasedGB: purchasedQuotaGB === null ? null : round2(totalCents / 100 / purchasedQuotaGB),
    purchasedQuotaGB: purchasedQuotaGB === null ? null : round2(purchasedQuotaGB),
    effectivePerActualGB: viable && quotaVerified ? round2(totalCents / 100 / usedTotal) : null,
    unusedQuotaGB: quotaVerified ? round2(unusedQuota) : null, idlePaidMonths, paidMonths, cycleMonths,
    validityMonths, requiredDevices, deviceLimit: limit,
    verificationStatus: !viable ? 'not_suitable' : limit === null || !quotaVerified ? 'needs_verification' : 'fits_entered_conditions',
    warnings,
  };
}

export function comparePlans(a, b, scenario) {
  const A = calculatePlan(a, scenario);
  const B = calculatePlan(b, scenario);
  let verdict;
  if (!A.viable && !B.viable) verdict = '两种方案都不满足输入的流量或设备需求，请调整条件。';
  else if (!A.viable) verdict = '只有方案 B 符合当前输入条件；仍须核实商家条款。';
  else if (!B.viable) verdict = '只有方案 A 符合当前输入条件；仍须核实商家条款。';
  else if (A.verificationStatus === 'needs_verification' || B.verificationStatus === 'needs_verification') {
    const diff = Math.abs(A.totalCents - B.totalCents) / 100;
    verdict = `当前现金支出差额 ¥${diff.toFixed(2)}，但至少一种方案的关键条款未知；请先核实条件，暂不作最终选购结论。`;
  }
  else if (A.totalCents === B.totalCents) verdict = '按当前假设，两种方案在使用期内的现金支出相同。';
  else {
    const cheaper = A.totalCents < B.totalCents ? 'A' : 'B';
    const saving = Math.abs(A.totalCents - B.totalCents) / 100;
    verdict = `按当前假设，方案 ${cheaper} 的现金支出少 ¥${saving.toFixed(2)}；还应考虑预付风险与服务条件。`;
  }
  return { A, B, verdict };
}
