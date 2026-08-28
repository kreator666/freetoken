# freetoken MCP Server

全 Agent 通用的 stdio MCP server，暴露 freetoken 核心能力：余额检查、赚 Token 提示、积分查询与兑换、打开任务墙等。

## 启动方式

推荐用 `node --import tsx` 启动，可绕过 pnpm 对构建脚本的检查：

```bash
node --import tsx ads-platform/mcp/server.ts
```

或：

```bash
pnpm mcp
```

> 如果 `pnpm mcp` 因 `ERR_PNPM_IGNORED_BUILDS` 失败，说明 pnpm 拒绝了 esbuild 的构建脚本，请改用 `node --import tsx` 方式。

## 提供的 Tools

| Tool | 说明 |
|---|---|
| `check_balance` | 检查 OpenAI 兼容 provider 余额 |
| `get_earn_token_prompt` | 生成标准化赚 Token 提示文本 |
| `get_user_points` | 查询用户积分和兑换记录 |
| `request_redeem` | 申请积分兑换 |
| `snooze_reminder` | 暂停提醒 N 分钟 |
| `is_snoozed` | 查询是否处于暂停状态 |
| `open_offerwall` | 打开系统浏览器到任务墙 |

## 各 Agent 配置示例

### ZCode

在 ZCode 设置中新增 MCP server（推荐用 `node --import tsx`，避免 pnpm 构建脚本问题）：

```json
{
  "mcpServers": {
    "freetoken": {
      "command": "node",
      "args": [
        "--import",
        "tsx",
        "D:/agent/freetoken/ads-platform/mcp/server.ts"
      ],
      "cwd": "D:/agent/freetoken"
    }
  }
}
```

### Claude Code

```bash
claude mcp add freetoken node --import tsx D:/agent/freetoken/ads-platform/mcp/server.ts
```

或手动编辑 `~/.claude/config.json`：

```json
{
  "mcpServers": {
    "freetoken": {
      "command": "node",
      "args": [
        "--import",
        "tsx",
        "D:/agent/freetoken/ads-platform/mcp/server.ts"
      ],
      "cwd": "D:/agent/freetoken"
    }
  }
}
```

### Codex (OpenAI)

编辑 `~/.codex/config.json`：

```json
{
  "mcpServers": {
    "freetoken": {
      "command": "node",
      "args": [
        "--import",
        "tsx",
        "D:/agent/freetoken/ads-platform/mcp/server.ts"
      ],
      "cwd": "D:/agent/freetoken"
    }
  }
}
```

### Cursor

在 Cursor Settings → MCP → Add New MCP Server 中：

- Name: `freetoken`
- Type: `command`
- Command: `node --import tsx D:/agent/freetoken/ads-platform/mcp/server.ts`
- CWD: `D:/agent/freetoken`

### 通用配置（JSON 格式）

```json
{
  "freetoken": {
    "command": "node",
    "args": [
      "--import",
      "tsx",
      "D:/agent/freetoken/ads-platform/mcp/server.ts"
    ],
    "cwd": "D:/agent/freetoken"
  }
}
```

## 自动触发机制

MCP server 是被动的，需要 Agent 主动调用。不同 Agent 的自动触发能力不同：

| Agent | 触发方式 | 是否每次对话自动触发 |
|---|---|---|
| **ZCode** | `UserPromptSubmit` hook 调用 `get_earn_token_prompt` | ✅ 是 |
| **Claude Code** | `AGENTS.md` / project instructions | ⚠️ 依赖模型自律 |
| **Codex** | `instructions.md` | ⚠️ 依赖模型自律 |
| **Cursor** | `.cursorrules` | ⚠️ 依赖模型自律 |

### ZCode 强制自动触发

ZCode 支持 hook 事件。把 `check-balance.js` 挂到 `UserPromptSubmit` 事件上：

```json
{
  "hooks": {
    "enabled": true,
    "events": {
      "UserPromptSubmit": [
        {
          "matcher": ".*",
          "hooks": [
            {
              "type": "process",
              "command": "node",
              "args": [
                "/path/to/check-balance.js",
                "prompt"
              ],
              "timeoutMs": 8000
            }
          ]
        }
      ]
    }
  }
}
```

这样每次用户发消息前，hook 会自动检查余额，并通过 stdout 返回 `{ "additionalContext": "..." }` 注入到对话中。

### 其他 Agent

需要把 instructions 放到对应位置：

- Claude Code: `.claude/AGENTS.md` 或 `~/.claude/AGENTS.md`
- Codex: `.codex/instructions.md` 或 `~/.codex/instructions.md`
- Cursor: `.cursorrules`

instructions 内容参考本项目：

- `AGENTS.md`
- `.claude/AGENTS.md`
- `.codex/instructions.md`
- `.cursorrules`

## Agent 使用示例


Agent 可以主动调用：

```
check_balance(baseURL="https://aiping.cn", apiKey="sk-xxx")
```

如果余额低，再调用：

```
get_earn_token_prompt(provider="aiping.cn", providerName="AIPing", type="balance", value=3.5, threshold=10)
```

Agent 会把返回的提示文本直接插入到回复中，用户点击链接即可进入任务墙。

## 注意事项

- MCP server 启动时会自动初始化 SQLite 数据库
- 数据库路径由 `ADS_DATA_DIR` 环境变量控制，默认在项目 `ads-platform/data` 下
- 确保 freetoken HTTP 服务（`pnpm dev`）和 MCP server 使用同一数据库目录
