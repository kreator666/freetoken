# ads-platform — 看广告赚 Token 积分

面向所有 AI Agent（ZCode、Claude Code、Codex、Trae、Cursor 等）的广告变现平台。当检测到模型 provider 余额/用量不足时，引导用户通过看广告或做任务赚取积分，积分可兑换成 provider token 额度。

## 目录结构

```
ads-platform/
├── server.ts          # Express 后端入口
├── config.ts          # 配置与环境变量
├── db.ts              # SQLite 数据层
├── routes/
│   ├── api.ts         # 积分、兑换、snooze 接口
│   └── postback.ts    # 广告平台 postback 回调
├── public/
│   ├── warn.html      # 余额不足落地页
│   └── dashboard.html # 用户积分面板
├── hooks/
│   └── zcode/         # ZCode hook 示例与配置
└── data/
    └── ads.sqlite     # 本地数据库（自动创建）
```

## 快速开始

1. 安装依赖

```bash
pnpm install
```

2. 复制环境变量并填写

```bash
cp .env.example .env
```

需要配置：

- `LOOTABLY_OFFERWALL_URL` / `LOOTABLY_SECRET`
- `ADGATE_WALL_URL` / `ADGATE_SECRET`（可选）
- `ADGEM_WALL_URL` / `ADGEM_SECRET`（可选）

3. 启动本地服务

```bash
pnpm ads:dev
```

服务默认运行在 `http://127.0.0.1:3099`。

4. 将 ZCode hook 脚本放到指定位置

```bash
cp ads-platform/hooks/zcode/check-balance.js ~/.zcode/hooks/
cp ads-platform/hooks/zcode/check-balance.config.json ~/.zcode/hooks/
```

## 核心数据流

```
Agent 启动 / 发送消息
    ↓
Hook 脚本检查 provider 余额或用量
    ↓
余额/用量低于阈值
    ↓
打开浏览器访问 http://localhost:3099/warn.html?...
    ↓
用户点击「看广告赚积分」
    ↓
进入 offerwall 页面完成任务
    ↓
广告平台发送 postback 到 /postback/:provider
    ↓
后端给用户账户加积分
    ↓
用户在 dashboard 申请兑换积分
    ↓
管理员根据兑换申请向 provider 充值（MVP 阶段手动）
```

## API 接口

| 接口 | 方法 | 说明 |
|---|---|---|
| `GET /api/health` | 健康检查 | |
| `GET /api/points?user=xxx` | 查询积分 | |
| `GET /api/redeems?user=xxx` | 查询兑换记录 | |
| `POST /api/redeem` | 申请兑换 | body: `{user, points, provider}` |
| `POST /api/snooze` | 设置 snooze | query: `user`, `provider`, `minutes` |
| `GET /api/snooze-check` | 查询 snooze 状态 | query: `user`, `provider` |
| `GET /postback/:provider` | 广告平台回调 | 由广告平台调用 |

## 广告平台接入

### Lootably（推荐）

1. 访问 [https://lootably.com](https://lootably.com) 注册开发者账号
2. 创建 offerwall，设置 postback URL：
   ```
   http://你的域名/postback/lootably
   ```
3. 将 offerwall URL 填入 `.env` 的 `LOOTABLY_OFFERWALL_URL`
4. 将 postback secret 填入 `LOOTABLY_SECRET`

### AdGate（可选）

1. 访问 [https://adgatemedia.com](https://adgatemedia.com) 注册
2. 配置 postback URL：
   ```
   http://你的域名/postback/adgate
   ```
3. 填写 `ADGATE_WALL_URL` 和 `ADGATE_SECRET`

## 扩展到其他 Agent

这个机制不局限于 ZCode。只要 Agent 能执行以下动作：

1. **读取 provider 配置**：找到当前使用的模型 provider 的 `baseURL` 和 `apiKey`
2. **调用余额/用量接口**：根据 provider 类型调用对应接口
3. **检测阈值并打开浏览器**：余额/用量低时，调用系统命令打开：
   ```
   http://你的域名/warn.html?provider=...&name=...&balance=...&threshold=...&user=...&type=...
   ```

就可以接入 ads-platform。

各 Agent 的 provider 配置位置参考：

| Agent | 配置位置 |
|---|---|
| ZCode | `~/.zcode/v2/config.json` |
| Claude Code | `~/.claude/config.json` 或项目级配置 |
| Codex (OpenAI) | `~/.codex/config.json` |
| Trae | 设置面板 / 项目配置 |
| Cursor | 设置面板 / `~/.cursor/config.json` |

## MVP 限制

- 积分兑换目前只生成「pending」申请，需要管理员手动向 provider 充值
- 广告平台 postback 签名算法需要以官方文档为准，目前代码里做了常见尝试
- 用户标识基于机器 hash，跨设备不共享

## 未来扩展

- 接入更多广告平台（穿山甲、优量汇等国内平台）
- 接入支付/自动充值 provider API
- 用户登录系统，跨设备同步积分
- 在 Agent 内部嵌入 WebView 广告墙
