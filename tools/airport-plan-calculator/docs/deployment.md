# 本地预览与发布边界

本计算器目前仅作为 `jichanglab-airport-guide` 仓库的源码提供，没有生产网站 URL，也没有启用 GitHub Pages。仓库内 `tools/plan-calculator.html` 是保留的基础版；本目录是带独立计算引擎和自动测试的升级版。

在 `tools/airport-plan-calculator/` 目录运行 `npm run check`，再启动本地静态服务器：

```bash
python3 -m http.server 8765 --directory site
```

访问 `http://127.0.0.1:8765/`。因为浏览器可能限制 `file://` 页面加载 ES Module，不应以双击 HTML 的方式测试此版本。

今后若获准发布到某个网站，应先确认实际 URL、备份和目录对应关系，在隔离环境测试后再为已上线的 URL 设置 Canonical、结构化数据及 Sitemap。当前 PR 不执行生产部署，也不假定任何预留地址已经上线。
