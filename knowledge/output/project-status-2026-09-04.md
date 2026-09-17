# FreeToken 项目状态总结（2026-09-04）

## 一、项目概况

**FreeToken v0.1.0** —— 面向 ZCode、Claude Code、Codex、Trae、Cursor 等 AI Agent 的"看广告赚 Token 积分"广告变现平台。

- 当 Agent 检测到模型 provider 余额不足 / token 用量过高时，引导用户看广告、做任务赚积分，积分可兑换 provider token 额度。
- 服务默认运行在 `http://127.0.0.1:3099`，线上域名为 `https://freetoken.xin`。
- 用户标识基于机器 hash（hostname + 用户名 + 平台 的 sha256 前 16 位），跨设备不共享。

## 二、技术栈

| 项 | 内容 |
|---|---|
| 运行时 | Node.js ^22 \|\| >=24，ESM |
| 后端 | Express 4 + better-sqlite3（本地 SQLite，MVP 零成本） |
| Agent 接入 | @modelcontextprotocol/sdk（stdio MCP server） |
| 校验 | zod |
| 语言 | TypeScript 5.5 + tsx 运行 |
| 包管理 | pnpm 11.7.0 |

## 三、代码结构（ads-platform/）

```
ads-platform/
├── server.ts          # Express 后端入口
├── config.ts          # 端口、数据目录、offerwall 环境变量、机器 ID 生成
├── db.ts              # SQLite 数据层（积分、兑换、snooze、postback 去重）
├── prompts.ts         # 赚 Token 提示文本生成
├── cli/               # 一键安装 / setup / mode 命令
│   ├── index.ts
│   ├── setup.ts
│   ├── mode.ts        # 修改提示模式（always / only-low-balance / silent）
│   └── utils.ts
├── mcp/server.ts      # 通用 MCP server（7 个 tools）
├── routes/
│   ├── api.ts         # 积分、兑换、snooze、prompt 接口
│   └── postback.ts    # 广告平台回调（Lootably / AdGate / AdGem）
├── public/            # index.html（Matrix 落地页）、warn.html、dashboard.html
├── hooks/zcode/       # ZCode UserPromptSubmit hook（check-balance.js + 配置）
└── data/ads.sqlite    # 本地数据库（自动创建）
```

**MCP tools**：`check_balance`、`get_earn_token_prompt`、`get_user_points`、`request_redeem`、`snooze_reminder`、`is_snoozed`、`open_offerwall`。

**业务规则**（config.ts）：1 point = 0.01 USD，每用户每日积分上限 500（5 USD），默认 snooze 30 分钟。

## 四、Git 状态

- 分支处于干净度较高的状态，工作区仅有 1 个已修改文件 + 1 个未跟踪目录：
  - `M ads-platform/hooks/zcode/check-balance.config.json` —— `promptMode` 由 `only-low-balance` 改为 `always`（**尚未提交**）
  - `?? .zcode/plans/` —— 未跟踪
- 最近提交（新→旧）反映的演进路线：
  1. MCP server 改为从 hook 配置读取 serverUrl（不再硬编码 localhost）
  2. 新增 `freetoken mode` 命令切换提示模式
  3. 提示模式可配置（always / only-low-balance / silent）
  4. IP/localhost 统一替换为 `freetoken.xin` 域名
  5. 中文回复偏好、AdSense 接入、自动配置 Trae / VSCode+Kimi Code
  6. 一键安装 CLI + 远程安装脚本、Matrix 落地页、stdio MCP server
  7. 早期：从其他项目拆分为独立的 freetoken 项目

## 五、各 Agent 触发机制现状

| Agent | 触发方式 | 每次对话自动触发 |
|---|---|---|
| ZCode | `UserPromptSubmit` hook + MCP `/api/prompt` | ✅ 是 |
| Trae / VSCode+Kimi Code / Claude Code / Codex / Cursor | MCP tools + instructions 文件 | ⚠️ 依赖模型自律 |

## 六、当前运行状态

- 本地服务 `http://127.0.0.1:3099` **当前未运行**（`/api/health` 无响应）。
- `knowledge/output/` 目录此前为空，本文件为首次产出。

## 七、已知问题与待办

1. **pnpm 工具链告警**：`pnpm typecheck` 等命令会先触发依赖状态检查，因 `esbuild@0.28.2` 的 build script 未被批准（需 `pnpm approve-builds`）而失败；这是 pnpm 安全机制问题，非代码错误。可直接用 `node_modules/.bin/tsc --noEmit` 绕过验证。
2. **未提交改动**：hook 配置的 `promptMode: always` 改动尚未 commit，需确认是否有意保留。
3. **MVP 限制**（README 记载）：
   - 积分兑换只生成 pending 申请，需管理员手动向 provider 充值
   - 广告平台 postback 签名算法以官方文档为准，目前为常见尝试实现
   - 无用户登录系统，积分跨设备不同步
4. **未来扩展方向**：接入国内广告平台（穿山甲、优量汇）、支付/自动充值 provider API、用户登录、Agent 内嵌 WebView 广告墙。
