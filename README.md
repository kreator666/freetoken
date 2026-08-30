# FreeToken — 看广告赚 AI Token 积分

一个面向 ZCode、Claude Code、Codex、Trae、Cursor 等 AI Agent 的广告变现平台。

当 Agent 检测到模型 provider 余额不足或 token 用量过高时，引导用户看广告 / 做任务赚取积分，积分可兑换成 provider token 额度。

## 核心功能

- ✅ 多 Agent 通用：通过 MCP server 暴露统一 tools
- ✅ 余额/用量监控：AIPing 余额、七牛 token 用量等
- ✅ 自动提示：ZCode 每次对话前自动检查余额并注入提示
- ✅ 广告墙变现：接入 Lootably / AdGate / AdGem 等 offerwall
- ✅ 积分系统：postback 自动加积分，支持兑换申请
- ✅ snooze 机制：用户可设置一段时间内不再提示
- ✅ 本地 SQLite：MVP 阶段零成本启动

## 快速开始

### 方式一：一键安装（推荐）

不需要先下载代码，一条命令自动下载、安装依赖、配置 Agent：

```bash
node -e "$(curl -fsSL https://raw.githubusercontent.com/kreator666/freetoken/main/install.js)"
```

或在 Windows PowerShell：

```powershell
(Invoke-WebRequest -Uri https://raw.githubusercontent.com/kreator666/freetoken/main/install.js -UseBasicParsing).Content | node -
```

安装脚本会：
1. 把代码下载到 `~/.freetoken`
2. 安装依赖
3. 自动配置 ZCode / Claude Code / Codex / Cursor
4. 创建默认 `.env`

安装完成后：
1. 编辑 `~/.freetoken/.env`，填入广告墙 URL
2. 启动服务：`cd ~/.freetoken && pnpm dev`
3. 完全退出并重新打开你的 Agent

### 方式二：手动安装

```bash
# 克隆代码
git clone https://github.com/kreator666/freetoken.git
cd freetoken

# 安装依赖
pnpm install

# 一键配置 Agent
pnpm setup
```

服务默认运行在 `http://127.0.0.1:3099`。

### 方式三：npm 全局安装（发布后）

```bash
npm install -g freetoken
freetoken setup
```

> 目前需要先发布到 npm。如果你自己有 npm 账号，可以运行 `npm publish` 发布。

## 目录结构

```
ads-platform/
├── server.ts          # Express 后端入口
├── config.ts          # 配置与环境变量
├── db.ts              # SQLite 数据层
├── mcp/
│   └── server.ts      # 全 Agent 通用 MCP server
├── routes/
│   ├── api.ts         # 积分、兑换、snooze 接口
│   └── postback.ts    # 广告平台回调
├── public/
│   ├── warn.html      # 余额不足落地页
│   └── dashboard.html # 用户积分面板
└── hooks/zcode/       # ZCode hook 示例
```

## Agent 接入

### MCP Server（推荐）

FreeToken 提供 stdio MCP server，所有支持 MCP 的 Agent 都能复用：

```json
{
  "freetoken": {
    "type": "stdio",
    "command": "node",
    "args": [
      "--import",
      "tsx",
      "/path/to/freetoken/ads-platform/mcp/server.ts"
    ],
    "cwd": "/path/to/freetoken"
  }
}
```

暴露的 tools：

| Tool | 说明 |
|---|---|
| `check_balance` | 检查 provider 余额 |
| `get_earn_token_prompt` | 生成赚 Token 提示文本 |
| `get_user_points` | 查询积分和兑换记录 |
| `request_redeem` | 申请积分兑换 |
| `snooze_reminder` | 暂停提醒 |
| `is_snoozed` | 查询暂停状态 |
| `open_offerwall` | 打开浏览器到任务墙 |

### 自动触发机制

| Agent | 触发方式 | 是否每次对话自动触发 |
|---|---|---|
| **ZCode** | `UserPromptSubmit` hook + MCP `/api/prompt` | ✅ 是 |
| **Trae** | MCP + 项目 instructions | ⚠️ 依赖模型自律 |
| **VSCode + Kimi Code** | MCP + 项目 instructions | ⚠️ 依赖模型自律 |
| **Claude Code** | AGENTS.md / project instructions | ⚠️ 依赖模型自律 |
| **Codex** | instructions.md | ⚠️ 依赖模型自律 |
| **Cursor** | .cursorrules | ⚠️ 依赖模型自律 |

> 注意：MCP server 本身是被动的，必须由 Agent 调用。目前只有 ZCode 的 hook 机制能真正做到"每次对话前强制检查余额并插入提示"。其他 Agent 需要依靠 MCP tools + instructions 引导模型主动调用 tools。

### ZCode 快速配置

1. 安装 MCP server（已配置到 `~/.zcode/cli/config.json` 和本项目 `.zcode/config.json`）
2. 复制 hook 脚本：
   ```bash
   cp ads-platform/hooks/zcode/check-balance.js ~/.zcode/hooks/
   cp ads-platform/hooks/zcode/check-balance.config.json ~/.zcode/hooks/
   ```
3. 重启 ZCode

### Trae 快速配置

Trae 通过 MCP server 接入。一键安装脚本会自动写入 `~/.trae/mcp_config.json`：

```json
{
  "mcpServers": {
    "freetoken": {
      "command": "node",
      "args": [
        "--import",
        "tsx",
        "/path/to/freetoken/ads-platform/mcp/server.ts"
      ],
      "cwd": "/path/to/freetoken"
    }
  }
}
```

如果自动配置没有生效，手动在 Trae 设置面板的 **MCP / 模型上下文协议** 中添加以上 server，然后重启 Trae。

### VSCode + Kimi Code 快速配置

Kimi Code 插件通过 VSCode 的 `settings.json` 配置 MCP server。一键安装脚本会尝试写入 `~/.vscode/settings.json`：

```json
{
  "kimi.mcpServers": {
    "freetoken": {
      "command": "node",
      "args": [
        "--import",
        "tsx",
        "/path/to/freetoken/ads-platform/mcp/server.ts"
      ],
      "cwd": "/path/to/freetoken"
    }
  }
}
```

> 注意：Kimi Code 插件不同版本的 MCP 配置键名可能不同（如 `kimi.code.mcpServers`、`kimi.mcpServers` 等）。如果上述键名不生效，请查看 Kimi Code 插件的官方文档或设置面板，找到对应的 MCP server 入口，手动复制以上 `command/args/cwd`。

配置完成后，完全重启 VSCode。

### 其他 Agent

参考项目内的 instructions 文件：

- `AGENTS.md` — ZCode / 通用
- `.claude/AGENTS.md` — Claude Code
- `.codex/instructions.md` — Codex
- `.cursorrules` — Cursor

## 广告平台接入

### Lootably（推荐）

1. 注册开发者账号：https://lootably.com
2. 创建 offerwall
3. 设置 postback URL：`https://你的域名/postback/lootably`
4. 填写 `LOOTABLY_OFFERWALL_URL` 和 `LOOTABLY_SECRET`

### AdGate / AdGem（可选）

类似流程，填入对应环境变量即可。

## API 接口

| 接口 | 方法 | 说明 |
|---|---|---|
| `GET /api/health` | 健康检查 | |
| `GET /api/prompt` | 赚 Token 提示文本 | `user`, `provider`, `name`, `type`, `value`, `threshold` |
| `GET /api/points?user=xxx` | 查询积分 | |
| `GET /api/redeems?user=xxx` | 查询兑换记录 | |
| `POST /api/redeem` | 申请兑换 | `{user, points, provider}` |
| `POST /api/snooze` | 设置 snooze | `user`, `provider`, `minutes` |
| `GET /api/snooze-check` | 查询 snooze | `user`, `provider` |
| `GET /postback/:provider` | 广告平台回调 | 由平台调用 |

## 未来扩展

- [ ] 接入支付/自动充值 provider API
- [ ] 用户登录系统，跨设备同步积分
- [ ] 接入国内广告平台（穿山甲、优量汇）
- [ ] 在 Agent 内部嵌入 WebView 广告墙

## License

MIT
