# Airport Plan Calculator｜机场套餐真实使用成本计算器

一个真正可运行、无第三方依赖的开源浏览器计算器：按**实际付款金额**、预计使用月数、月流量、节点倍率、套餐重置规则与有效期比较两种套餐的现金成本。

**项目不是机场测速排名或实时价格数据库；仓库不包含任何机场的邀请、登录、购买链接。** 示例金额为虚构的计算演示，不代表任何真实品牌的套餐。

## 核心功能

- 月付 / 季付 / 半年付 / 年付，预付款不虚构成按月支付。
- 一次性流量包、有效期分窗、可重复购买的假设和跨期过期损耗。
- 月度额度重置与按付款周期固定额度分别计算。
- 节点流量计费倍率（使用50GB，倍率2代表套餐计费100GB）。
- 设备上限检查：缺失数据标为“待核实”，不会把较低价格直接当作最终购买结论。
- 两种方案并排比较、整期实际现金支出、未用预付月份、名义每已购 GB 成本与每真实使用 GB 成本。
- 流量重置规则或设备上限未知时显示待核实，不宣称方案适合购买。
- 完全浏览器本地计算；不收集帐号、订单或订阅密钥；无 CDN、外部脚本或 API 请求。

## 运行

需要 Node.js 20+（仅用于开发测试），网站使用时不需要安装 Node。

在本目录运行：

```bash
npm run check
python3 -m http.server 8765 --directory site
```

浏览器访问 `http://127.0.0.1:8765/`。由于浏览器对 `file://` 的 ES Module 限制，请使用本地 HTTP Server 或正常 HTTPS 网站，不要直接双击 HTML 进行功能验收。

## 原始示例

假定每月实际使用50GB、需要1台设备、计划使用12个月、节点倍率1：

| 方案 | 一次扣款 | 周期 | 每月额度 | 预计总现金支出 |
|---|---:|---|---:|---:|
| A | ¥12 | 月付 | 100GB | ¥144 |
| B | ¥120 | 年付 | 100GB/月（按月重置） | ¥120 |

如果只使用3个月，A需付¥36，B仍需预付¥120。**年付月均价并不是可以分月付款的价格。** 具体算法与一次性套餐假设见 [`docs/methodology.md`](docs/methodology.md)。

## 项目结构

```text
src/engine.mjs           # 可测试的纯计算引擎
site/index.html          # 完整中文静态页面
site/assets/app.js       # 输入控件与展示逻辑
site/assets/site.css     # 本地响应式样式
site/assets/engine.mjs   # build同步的引擎副本
tests/engine.test.mjs    # Node 原生测试
examples/scenarios.json  # 不涉及真实品牌的演示数据
scripts/build.mjs        # 复制引擎到静态站
../../.github/workflows/airport-calculator-ci.yml # 仓库级自动测试，无自动部署
docs/                   # 方法、SEO与部署文档
```

## 仓库定位与发布状态

本工具是 `jichanglab-airport-guide` 仓库内的独立目录；原有的基础计算器仍位于 `../plan-calculator.html`。新版提供可复用的 JavaScript 引擎和自动测试，旧版可直接双击本地 HTML 使用。当前没有独立上线地址，也没有启用 GitHub Pages。预览方式见 [`docs/deployment.md`](docs/deployment.md)。

## 声明与许可

工具依据用户自行填写的假设给出计算值，不能验证套餐真实性、客户端兼容性、付款归因或服务质量。请核实真实条件后再做购买决策。

MIT License，见 `LICENSE`。
