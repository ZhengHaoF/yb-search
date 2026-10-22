# YB Search 设计文档

> 基于腾讯云元宝搜索（WSA `SearchPro`）API 的私有搜索站点
>
> 版本：v1.0（设计定稿） · 日期：2026-10-22 · 状态：待实现

## 1. 背景与目标

对接 [元宝搜索 API](./元宝搜索.md)，做一个干净、快速的网页搜索站：用户在首页输入检索词，站点调用腾讯云 `wsa.tencentcloudapi.com` 的 `SearchPro` 接口，按接口排序展示网页结果，并呈现标题、站点、时间、摘要、配图、子链等富信息。

目标：

- 私有自用，密钥只存在服务端，绝不下发浏览器。
- 覆盖接口支持的全部搜索参数：`Mode`、`Site`、`Cnt`、`Industry`、`Freshness`、`Deeplinks`。
- 本地优先跑通；部署后置为 v1.1。
- 视觉极简、内容优先，桌面与移动端可用。

非目标（v1）：

- 不做分页 —— 接口无分页参数，单次最多 50 条。
- 不自建索引，不做 AI 总结答案（接口只返回网页结果）。
- 不做用户体系、多租户；仅预留可选单口令。
- 不做深色模式、搜索联想、埋点统计、服务端结果缓存。
- 暂不部署、不限流；这些在部署阶段补齐。

## 2. 已确认决策

| 决策点 | 结论 |
|---|---|
| 站点定位 | 私有自用，先本地运行；代码结构不锁死后续公开 |
| 接口版本 | 按旗舰版能力设计，按响应 `Version` 自动降级 |
| 后端 | 同仓库 Fastify 服务，官方 Node SDK 签名并代理 `/api/search` |
| 前端 | Vue 3 + Vite + TypeScript，不引 UI 组件库 |
| 结果形态 | 只有富结果页；不接大模型做 AI 总结 |
| 分页 | 不做，条数由 `Cnt` 控制（10/20/30/40/50） |
| 参数暴露 | 接口支持的全部参数都做，包含站点包含/排除、时效全形态 |
| 登录 | 功能先实现，`SITE_PASSWORD` 未设置时不启用（本地免登录） |
| 部署 | 本轮只本地验证；后续部署到现有腾讯云服务器 82.156.168.149 |
| 站点名称 | YB Search，副标「元宝搜索 · 自用」 |

## 3. 总体架构

```
浏览器（Vue 3 SPA，同源请求）
    │  POST /api/search
    ▼
Fastify（Node 24，单进程）
    ├─ 可选口令鉴权（SITE_PASSWORD）
    ├─ 参数校验 / 规范化
    ├─ 能力探测与降级
    ├─ tencentcloud-sdk-nodejs-wsa（TC3-HMAC-SHA256 签名）
    └─ 生产环境托管 dist 静态资源
    │  HTTPS
    ▼
wsa.tencentcloudapi.com  ·  SearchPro  ·  2025-05-08
```

密钥边界：

- `TENCENTCLOUD_SECRET_ID` / `TENCENTCLOUD_SECRET_KEY` 只从服务端 `.env` 读取。
- 前端只能访问 `/api/*`，Vite 只注入 `VITE_*` 前缀变量，本项目不使用任何 `VITE_*` 密钥。
- `.env` 进 `.gitignore`，仓库只提交 `.env.example`。

## 4. 技术栈与项目结构

| 层 | 选型 |
|---|---|
| 前端 | Vue 3 + Vite + TypeScript，原生 CSS + CSS 变量 |
| 后端 | Node 24 + Fastify 5 + `@fastify/static` + `@fastify/cookie` |
| 腾讯云 | `tencentcloud-sdk-nodejs-wsa`（4.1.x，已确认可用） |
| 开发运行 | `tsx watch` 跑服务端，Vite 跑前端并代理 `/api` |
| 测试 | Vitest（参数映射、响应解析纯函数）；浏览器验证用 Playwright + 本机 Chrome |

```
yb-search/
├─ 元宝搜索.md                # 接口原始文档
├─ DESIGN.md                  # 本文档
├─ package.json               # 根脚本：dev / build / start / typecheck / test
├─ vite.config.ts             # 前端构建，/api 代理到 :3100，@shared 别名
├─ tsconfig.json              # 前端 + shared
├─ tsconfig.server.json       # 服务端
├─ index.html                 # SPA 入口
├─ .env.example
├─ .gitignore
├─ public/                    # favicon.svg 等静态资源
├─ src/                       # 前端
│  ├─ main.ts
│  ├─ App.vue                 # 按 URL 中 q 决定首页 / 结果页，无 vue-router
│  ├─ api/client.ts           # fetch 封装、登录态、错误归一化
│  ├─ composables/
│  │  ├─ useSearch.ts         # 请求、AbortController、加载/错误状态
│  │  ├─ useUrlState.ts       # URL 同步、pushState/replaceState、popstate
│  │  └─ useRecentSearches.ts # localStorage 最近 10 条
│  ├─ components/
│  │  ├─ SearchBar.vue
│  │  ├─ FilterBar.vue
│  │  ├─ FreshnessPicker.vue
│  │  ├─ SitePicker.vue
│  │  ├─ ResultCard.vue
│  │  ├─ ResultSkeleton.vue
│  │  ├─ EmptyState.vue
│  │  ├─ ErrorState.vue
│  │  └─ LoginGate.vue
│  └─ styles/
│     ├─ tokens.css
│     └─ global.css
├─ server/
│  ├─ index.ts                # 启动、静态托管、SPA fallback
│  ├─ auth.ts                 # 可选口令 + 签名 cookie
│  ├─ errors.ts               # 错误码映射
│  ├─ routes/search.ts
│  ├─ routes/auth.ts
│  └─ wsa/
│     ├─ client.ts            # SDK 客户端与能力缓存
│     ├─ map-request.ts       # 校验与参数映射
│     └─ parse-response.ts    # Pages JSON 解析与归一化
├─ shared/
│  └─ types.ts                # 前后端共享的请求/响应类型
├─ tests/
│  ├─ map-request.test.ts
│  ├─ parse-response.test.ts
│  └─ client-retry.test.ts    # 版本探测/最小参数重试
├─ scripts/
│  ├─ verify-ui.mjs           # Playwright 桌面/移动端验收
│  └─ verify-login.mjs        # 登录流程验收
├─ test-results/              # 验收截图（gitignore）
└─ dist/                      # 构建产物（gitignore）
```

根脚本：

| 命令 | 行为 |
|---|---|
| `npm run dev` | 并行启动 Fastify（:3100）与 Vite（:5180），前端代理 `/api` |
| `npm run build` | `vue-tsc --noEmit && vite build`，产物输出 `dist/` |
| `npm start` | 生产模式启动 Fastify，单端口托管 `dist/` 与 API |
| `npm run typecheck` | 前端 `vue-tsc` + 服务端 `tsc` 类型检查 |
| `npm run test` | Vitest 纯函数单测 |

## 5. 后端设计

### 5.1 WSA 客户端

- 使用 `tencentcloud-sdk-nodejs-wsa` 的 `wsa.v20250508.Client`。
- endpoint：`wsa.tencentcloudapi.com`；不传 `Region`（接口不需要）。
- 超时 15 秒；服务端不自动重试（能力探测回退除外），避免透支配额。
- 发起调用不带 `X-TC-*` 之外的额外头，签名交给 SDK。

### 5.2 对外 API

#### `POST /api/search`

请求体（字段均为规范化后的字符串/数字，便于 URL 与上游共用同一套表示）：

```jsonc
{
  "query": "人工智能发展现状",        // 必填，去首尾空格，1–200 字符
  "mode": 2,                        // 可选：0 网页 / 1 权威 / 2 综合
  "site": "exclude:qq.com|sohu.com",// 可选：单域名 或 exclude:最多5个
  "cnt": 20,                        // 可选：10/20/30/40/50
  "industry": "news",               // 可选：gov/news/acad/finance
  "freshness": "d7",                // 可选：dN/mN/yN/单日/区间
  "deeplinks": true                 // 可选，默认 true
}
```

成功响应：

```jsonc
{
  "query": "人工智能发展现状",
  "version": "flagship",            // lite / standard / flagship
  "results": [
    {
      "title": "……",
      "url": "https://……",
      "date": "2025/02/26 09:37:00",
      "passage": "……",
      "content": "……",
      "site": "中国网信网",
      "score": 0.84889734,
      "authorityLevel": 4,
      "favicon": "https://……",
      "pics": [{ "caption": "……", "originUrl": "https://……" }],
      "deeplinks": [{ "title": "……", "url": "https://……" }]
    }
  ],
  "count": 1,
  "elapsedMs": 842,
  "requestId": "39684d0c-…",
  "msg": null
}
```

- `msg` 透传上游提示（如 `hit black query`），前端以信息条呈现。
- 解析 `Pages` 时逐条 `JSON.parse`，坏数据跳过；缺少合法 `http(s)` URL 的条目丢弃。
- 若全部条目解析失败，返回 502 `RESULT_PARSE_FAILED`。

错误响应：

```jsonc
{ "error": { "code": "WSA_RESOURCE_NOT_FOUND", "message": "用户资源未开通", "requestId": "…" } }
```

| HTTP | code | 含义 / 前端文案 |
|---|---|---|
| 400 | `INVALID_PARAM` | 筛选条件不合法，检查后重试 |
| 401 | `UNAUTHORIZED` | 需要登录（启用口令时） |
| 401 | `WSA_AUTH_FAILURE` | 密钥无效或未授权，请检查 `.env` 与控制台权限 |
| 403 | `WSA_UNAUTHORIZED_OPERATION` | 未授权操作，请检查腾讯云子账号权限 |
| 404 | `WSA_RESOURCE_NOT_FOUND` | 元宝搜索服务未开通，请到控制台激活 |
| 429 | `WSA_REQUEST_LIMIT_EXCEEDED` | 请求太频繁，请稍后重试 |
| 502 | `WSA_INTERNAL_ERROR` | 腾讯云内部错误，请稍后重试 |
| 502 | `WSA_NETWORK_ERROR` | 无法连接元宝搜索服务 |
| 503 | `WSA_RESOURCE_UNAVAILABLE` | 服务不可用（欠费或未激活） |
| 502 | `RESULT_PARSE_FAILED` | 结果解析失败，请重试 |

#### 其他接口

| 接口 | 说明 |
|---|---|
| `POST /api/login` | 口令登录，成功设置签名 HttpOnly cookie，有效期 7 天 |
| `POST /api/logout` | 清除 cookie |
| `GET /api/session` | 返回 `{ authRequired, authenticated }`，前端决定是否显示登录页 |
| `GET /api/health` | 健康检查，返回 `{ ok: true }` |

### 5.3 参数映射与校验

| 前端/URL 规范值 | 上游参数 | 服务端校验 |
|---|---|---|
| `query` | `Query` | 非空，1–200 字符 |
| `mode` | `Mode` | 仅 `0` / `1` / `2` |
| `site` | `Site` | 包含：单域名；排除：`exclude:` 前缀 + 最多 5 个，`\|` 分隔 |
| `cnt` | `Cnt` | 仅 `10/20/30/40/50` |
| `industry` | `Industry` | 仅 `gov/news/acad/finance` |
| `freshness` | `Freshness` | 见下方规则 |
| `deeplinks` | `Deeplinks` | 布尔；能力不支持时丢弃 |

域名规则：仅主机名，大小写不敏感；不允许协议、路径、端口、空格；形如 `zhihu.com`（子域合法）。

Freshness 规则：

- 相对时间：`d1`–`d30`、`m1`–`m12`、`y1`–`y5`。
- 指定单日：`YYYY-MM-DD`，不得早于 1970-01-01、不得晚于今天。
- 日期区间：`YYYY-MM-DD,YYYY-MM-DD`，两端均需合法且 **开始 ≤ 结束**。
- 原文档中「日期 B 不得晚于日期 A」与区间语义矛盾，按「开始 ≤ 结束」处理。

### 5.4 能力探测与降级

| 能力 | lite（极速版） | standard（标准版） | flagship（旗舰版） |
|---|---|---|---|
| `Mode` / `Cnt` / `Industry` | 不支持 | 支持 | 支持 |
| `content` / `pics` | 不返回 | 返回 | 返回 |
| `authority_level` | 不返回 | 不返回 | 返回 |
| `Deeplinks` | 不支持 | 不支持 | 支持 |
| `Freshness` | 支持 | 支持 | 支持 |

策略：

1. 每次成功响应读取 `Version`，以进程内缓存记录能力，后续请求自动剔除不支持参数。
2. 版本未知时若上游返回「不支持参数」类的 `InvalidParameter`，自动以最小参数集重试一次并记录版本；仍失败则原样报错。
3. 响应中始终带 `version`，前端据此隐藏不支持控件（极速版隐藏模式/领域/条数，非旗舰隐藏子链开关）。
4. 若不支持参数由用户显式设置，服务端剔除并在响应 `msg` 中追加温和提示（如「当前版本不支持领域筛选，已忽略」）。

### 5.5 鉴权（可选）

- 未设置 `SITE_PASSWORD`：完全关闭登录，`/api/session` 返回 `authRequired: false`。
- 设置后：`SESSION_SECRET` 必须存在，否则启动失败并提示。
- 登录口令比较使用恒定时间比较（先做 SHA-256 再 `timingSafeEqual`）。
- cookie：`yb_session`，值为签名载荷（含签发时间），`HttpOnly`、`SameSite=Lax`、`Path=/`、7 天；`COOKIE_SECURE=true` 时加 `Secure`。
- 受保护范围：`/api/search`、`/api/logout`；`/api/login`、`/api/session`、`/api/health` 与静态资源不受保护。
- 前端启动时请求 `/api/session`；需要登录且未登录时展示 `LoginGate`，登录成功后重新搜索。
- 页脚在启用登录时显示「退出登录」。

### 5.6 环境变量

| 变量 | 必填 | 说明 |
|---|---|---|
| `TENCENTCLOUD_SECRET_ID` | 是 | 腾讯云密钥 ID，仅服务端 |
| `TENCENTCLOUD_SECRET_KEY` | 是 | 腾讯云密钥 Key，仅服务端 |
| `PORT` | 否 | 默认 `3100`（本机 3000 被其他服务占用） |
| `SITE_PASSWORD` | 否 | 设置即启用单口令登录 |
| `SESSION_SECRET` | 条件 | 启用口令时必填，用于 cookie 签名 |
| `COOKIE_SECURE` | 否 | 部署 HTTPS 后设为 `true` |
| `LOG_QUERY` | 否 | 默认 `0`；`1` 时日志记录查询词 |

`.env.example` 提供以上键名与空值，不含真实密钥。服务端启动时用 `process.loadEnvFile('.env')` 加载。

### 5.7 日志

- Fastify 默认请求日志：方法、路径、状态码、耗时、上游 `RequestId`、版本。
- 默认不记录查询词（`LOG_QUERY=1` 才记录）。
- 绝不记录 SecretId / SecretKey / cookie / 请求签名。

## 6. 前端设计

### 6.1 信息架构与路由

- 不使用 vue-router；`App.vue` 根据 URL 是否带 `q` 切换首页 / 结果页。
- 浏览器前进后退由 `popstate` 监听恢复状态并重新请求。
- 新查询提交 `pushState`；筛选变化 `replaceState`（避免历史记录被筛选切换淹没）。
- 启动时读取 URL；非法值丢弃并回退默认值，不弹错。

### 6.2 布局

首页：

```
┌──────────────────────────────────────────────┐
│                                              │
│                  YB Search                   │
│              元宝搜索 · 自用                   │
│                                              │
│     ┌────────────────────────────────┐       │
│     │  搜索全网内容…            [搜索] │       │
│     └────────────────────────────────┘       │
│                                              │
│   最近搜索：人工智能   Vue 3   …   清空       │
│                                              │
│   数据来源：腾讯云元宝搜索 API                 │
└──────────────────────────────────────────────┘
```

结果页：

```
┌──────────────────────────────────────────────┐
│  YB        [ 搜索框（紧凑）        ] [搜索]   │  ← 吸附，白底 + 细底边
│  综合 | 网页 | 权威   时效▾  领域▾  条数▾  ⚙站点 │  ← 筛选行
├──────────────────────────────────────────────┤
│  共 20 条 · 用时 842 ms · 旗舰版               │
│                                              │
│  ┌ favicon  标题（新标签打开）                 │
│  │ 站点 · 2025-02-26   [权威]                 │
│  │ 摘要最多三行……                              │
│  │ [图1] [图2] [图3]                           │
│  │ ▸ 子页 (5)                                  │
│  └──────────────────────────────              │
│  …                                           │
└──────────────────────────────────────────────┘
```

- 内容列宽 720–760px 居中。
- 桌面端筛选两行常显；≤ 768px 时筛选收进底部抽屉（「筛选」按钮 + 当前条件数徽标）。
- 顶部吸附区白底、96% 不透明、细底边；不使用重阴影。

### 6.3 搜索栏与快捷键

- 首页大输入框（高 52–56px，圆角，聚焦时强调色描边）；结果页紧凑输入框。
- Enter 或点击「搜索」提交；空查询不请求。
- `/` 聚焦搜索框（焦点不在输入控件时）。
- Esc：清空输入并失焦。
- 搜索中再次提交会取消上一请求（AbortController）。
- 无自动补全联想（接口不提供）。

### 6.4 筛选器

**结果类型（Mode）**：分段控件「综合 (2，默认) / 网页 (0) / 权威 (1)」。
- 综合 = 混合结果；网页 = 公开网页信源；权威 = 优质权威垂直信源。
- 极速版隐藏该控件且不发送参数。

**时效（Freshness）**：
- 快捷 chips：不限 / 近1天 / 近7天 / 近30天 / 近1年（`d1`、`d7`、`d30`、`y1`）。
- 「自定义」弹层：
  - 相对时间：数字 + 单位（天 1–30 / 月 1–12 / 年 1–5）；
  - 指定日期：日期选择器，范围 1970-01-01 至今天；
  - 日期区间：两个日期，自动校验开始 ≤ 结束、不晚于今天。
- 当前自定义值以 chip 文字回显（如「近3月」「2026-08-20」「08-20 ~ 08-30」）。

**领域（Industry）**：下拉「不限 / 新闻 / 政府 / 学术 / 财经」，值 `news/gov/acad/finance`。极速版隐藏。

**条数（Cnt）**：下拉 10 / 20 / 30 / 40 / 50，默认 20。极速版隐藏。

**站点（Site）**：「高级」弹层，单选两种模式：
- 包含：单个域名输入；
- 排除：tag 输入，最多 5 个（支持逐个删除）。
- 校验域名格式；提示「站点条件只作用于普通网页结果，权威卡不受影响」。
- 应用后以 chip 展示（如「站内：zhihu.com」「排除：2 站」）。

**子链（Deeplinks）**：开关，默认开。版本未知时先发送；确认非旗舰后隐藏开关并停止发送。

筛选变化立即触发搜索（站点/时效自定义在弹层确认时触发）；URL 同步更新。

### 6.5 结果卡片

- favicon：懒加载，加载失败或缺失时显示站点首字母占位；`referrerpolicy="no-referrer"`。
- 标题：主链接，`target="_blank" rel="noopener noreferrer"`，最多两行；缺失时用 URL 主机名兜底。
- 元信息：站点名（缺失用主机名）· 日期（`YYYY/MM/DD` 归一为 `YYYY-MM-DD`，无日期则省略）。
- 权威徽标：`authorityLevel ≥ 4` 时显示「权威」；不显示分数数字。
- 摘要：优先 `passage`，为空则用 `content`，最多三行截断。
- 配图：最多 3 张缩略图（4:3 裁切），懒加载，点击新标签打开原图；加载失败隐藏该图。
- 子链：折叠按钮「子页 (N)」，展开后列出最多 10 条，均新标签打开。
- 所有来自接口的文本使用 Vue 插值渲染，**禁止 `v-html`**；链接仅接受 `http/https`。
- 卡片间距 20–24px，分隔线替代重边框；悬停时标题变强调色。

### 6.6 状态与容错

| 状态 | 表现 |
|---|---|
| 加载中 | 5 条骨架屏，保持页面结构稳定 |
| 首次加载版本未知 | 按全量控件展示，拿到 `version` 后调整 |
| 0 结果 | 空状态文案 + 建议（换关键词、放宽时效/领域、移除站点限制）+「清空筛选」 |
| 黑名单词等提示 | 顶部信息条展示上游 `msg`，不当作错误 |
| 请求错误 | 错误卡片：中文说明 + `RequestId`（一键复制）+ 重试按钮 |
| 新请求发起 | 取消未完成请求，旧响应不覆盖新状态 |
| 部分坏数据 | 静默跳过；全部坏数据则报解析失败 |
| 登录启用且未登录 | 全屏登录卡片，登录后恢复原查询 |

### 6.7 URL 状态

| 参数 | 取值 | 默认（省略） |
|---|---|---|
| `q` | 查询词 | 空 → 首页 |
| `mode` | `0/1/2` | `2` |
| `freshness` | `d7` / `m3` / `y1` / `2026-08-20` / `2026-08-20,2026-08-30` | 不限 |
| `industry` | `gov/news/acad/finance` | 不限 |
| `cnt` | `10/20/30/40/50` | `20` |
| `site` | `zhihu.com` 或 `exclude:a.com\|b.com` | 不限 |
| `deeplinks` | `0` | 开（省略） |

默认值不写入 URL；刷新、收藏、分享均可还原查询与筛选。非法值静默回退默认。

### 6.8 最近查询

- localStorage 键：`yb.recent.v1`，仅存查询词，最多 10 条，去重、最新在前。
- 只在成功提交后写入（空查询不写）。
- 首页聚焦搜索框时以下拉/列表展示；点击直接搜索；支持「清空」。
- 结果页不展示历史，避免遮挡结果。

### 6.9 设计系统

| 项 | 值 |
|---|---|
| 背景 | `#FFFFFF`；次级面 `#F7F8FA` |
| 主文本 / 次文本 | `#1F2329` / `#646A73` |
| 边框 | `#E5E6EB` |
| 强调色 | `#0052D9`；强调浅底 `#E8F1FF` |
| 圆角 | 输入框/卡片 10px；chip 999px |
| 字体 | 系统字体栈（PingFang SC、Microsoft YaHei、system-ui 等），不加载外部字体 |
| 字号 | 结果标题 18px/600；摘要 14px；元信息 12–13px |
| 间距 | 8px 网格 |
| 动效 | 150–200ms ease；骨架屏微光；尊重 `prefers-reduced-motion` |
| 响应式 | ≤ 768px 移动布局；≥ 1200px 内容列居中 |

品牌：文字标识「YB Search」，可用一个简单几何标记（内联 SVG），不依赖图片资源。浅色主题，无深色模式。

无障碍：语义化标签、输入框 label、筛选弹层 `aria-expanded`、结果数量与错误用 `aria-live` 播报、清晰 focus ring、颜色对比达标。

## 7. 安全与配额

- 密钥与签名只在服务端；前端构建产物中不得出现 SecretId/Key（验收时检查 `dist/`）。
- 服务端校验全部入参；不代用户抓取 URL，无 SSRF 面。
- 渲染层不使用 `v-html`；外链一律 `noopener noreferrer`；图片仅 http/https。
- cookie 签名、HttpOnly、SameSite=Lax；HTTPS 环境强制 `Secure`。
- 站点公开前需限流（部署阶段：约 60 次/分钟/IP），当前本地不实现。
- 每次提交搜索即一次计费调用：不做按键联想、不做自动刷新；取消请求不退还配额。v1 不做结果缓存。

## 8. 本地开发与运行

1. `npm install`
2. 复制 `.env.example` 为 `.env`，填入 `TENCENTCLOUD_SECRET_ID` / `TENCENTCLOUD_SECRET_KEY`
3. `npm run dev` → 打开 http://localhost:5180
4. 生产形态验证：`npm run build && npm start` → http://localhost:3100

首次真实搜索即验证：

- wsa 服务是否已开通（`ResourceNotFound` = 未开通）；
- 账号实际版本（结果摘要行右侧版本徽标）；
- 若为极速版/标准版，确认控件自动隐藏且请求参数被正确剔除。

实测记录（2026-10-22）：当前账号返回 `Version=standard`（标准版），`content`/`pics` 正常返回，`authority_level` 与 `deeplinks` 不返回；前端已自动隐藏「子链」开关与「权威」徽标。若后续升级旗舰版，无需改代码，刷新后自动恢复对应能力。

## 9. 验收标准

| # | 场景 | 期望 |
|---|---|---|
| 1 | 首页加载 | 品牌、搜索框、最近查询、数据来源页脚正常；无控制台错误 |
| 2 | 真实搜索 | 展示结果卡片，摘要行有 N 条 / 耗时 / 版本 |
| 3 | 全部筛选 | Mode、时效快捷与自定义三形态、领域、条数、站点包含/排除、子链均生效，且 URL 同步 |
| 4 | 刷新 / 前进后退 | 查询与筛选完整还原；后退不产生重复请求错误 |
| 5 | 卡片内容 | favicon 兜底、日期归一、配图、子链、权威徽标均能优雅缺省 |
| 6 | 状态 | 骨架屏、0 结果、错误 + RequestId 复制、取消旧请求均正常 |
| 7 | 登录开关 | 未设 `SITE_PASSWORD` 免登录；设置后必须先登录才能搜索，退出后再次拦截 |
| 8 | 降级 | 极速版隐藏 Mode/领域/条数，非旗舰隐藏子链；请求不携带不支持参数 |
| 9 | 移动端 | 390px 宽度下布局不溢出，筛选抽屉可用 |
| 10 | 构建 | `npm run typecheck`、`npm run test`、`npm run build` 全部通过 |
| 11 | 安全 | `dist/` 中搜索不到密钥；接口内容无 `v-html` 注入面 |
| 12 | 浏览器验证 | 用 Playwright + 本机 Chrome 截图核对桌面与移动视口 |

### 验收执行

- 生产服务：`npm start`（默认 http://127.0.0.1:3100）
- 单测：`npm test`（34 项）
- 类型检查 + 构建：`npm run typecheck && npm run build`
- 桌面/移动端 UI 验收：`npm run verify:ui`，截图输出到 `test-results/`
- 登录验收：以 `PORT=3200 SITE_PASSWORD=... SESSION_SECRET=... npm start` 启动独立实例，再执行 `BASE_URL=http://127.0.0.1:3200 npm run verify:login`

自动化用例覆盖：真实标准版搜索、全部筛选参数、站点包含/排除、URL 还原、前进后退、骨架屏与取消旧请求、0 结果、错误态与 RequestId 复制、极速版/旗舰版能力切换、移动端布局与筛选抽屉、快捷键、登录/退出。

## 10. 后续（不在本轮范围）

- **v1.1 部署**：腾讯云服务器 82.156.168.149（该机已跑宝塔多站点、Node 16 不在 PATH，需自备 Node 24 运行时，反向代理沿用现有 nginx/宝塔配置）；HTTPS（有域名时）；启用 `SITE_PASSWORD`；IP 限流。
- **v2 可选**：AI 总结答案（另接大模型）、深色模式、结果缓存、图片代理（应对第三方防盗链）、公开访问所需的多用户/配额策略。

## 11. 风险与备注

- **服务未开通 / 版本差异**：首调验证；以响应 `Version` 为准自动降级。
- **接口 `Pages` 为 JSON 字符串数组**：逐条解析，坏条目跳过；不能让单条坏数据拖垮整页。
- **图片与 favicon 防盗链**：v1 用占位兜底，必要时加服务端图片代理。
- **接口无分页**：`Cnt` 最多 50；用户需要更多结果只能细化查询。
- **文档矛盾**：Freshness 区间方向按「开始 ≤ 结束」实现；如接口实际相反，联调时校正并更新本文。
- **配额成本**：私人使用频次低；不做联想/预取/自动刷新，避免无谓调用。

## 附录 A：接口摘要

- 域名：`wsa.tencentcloudapi.com`
- Action：`SearchPro`；Version：`2025-05-08`；POST JSON；不需要 Region。
- 入参：`Query`（必填）、`Mode`、`Site`、`Cnt`、`Industry`、`Freshness`、`Deeplinks`。
- 出参：`Query`、`Pages`（JSON 字符串数组）、`Version`、`Msg`、`RequestId`。
- `Pages` 单条字段：`title`、`date`、`url`、`passage`、`content`、`site`、`score`、`authority_level`、`pics[{caption, origin_url}]`、`favicon`、`deeplinks[{title, url}]`。
- 字段支持差异：`content`/`pics` 极速版不返回；`authority_level`、`deeplinks` 仅旗舰版；`Mode`/`Cnt`/`Industry` 极速版不支持。
- 业务错误码：`InternalError`、`InvalidParameter`、`RequestLimitExceeded`、`ResourceNotFound`、`ResourceUnavailable`、`UnauthorizedOperation`。

## 附录 B：决策记录

| 轮次 | 决策 |
|---|---|
| 第 1 轮 | 私有自用；旗舰版设计并自动降级；Fastify 同仓代理；Vue 3 + Vite + TS；v1 无 AI 总结 |
| 第 2 轮 | 富结果卡片细节；极简浅色视觉；站点名 YB Search；URL 状态、最近查询、快捷键；部署后置 |
| 第 3 轮 | 全部接口参数暴露（含站点包含/排除、时效全形态）；本地免登录运行形态；状态与容错细节 |
