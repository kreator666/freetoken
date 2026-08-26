# FreeToken — 看广告赚 AI Token 积分

一个面向 ZCode、Claude Code、Codex、Trae、Cursor 等 AI Agent 的广告变现平台。

当 Agent 检测到模型 provider 余额不足或 token 用量过高时，自动打开浏览器引导用户看广告 / 做任务赚取积分，积分可兑换成 provider token 额度。

## 核心功能

- ✅ 多 Agent 通用：任何能读取 provider 配置并调用 HTTP 的 Agent 都能接入
- ✅ 余额/用量监控：AIPing 余额、七牛 token 用量等
- ✅ 广告墙变现：接入 Lootably / AdGate / AdGem 等 offerwall
- ✅ 积分系统：postback 自动加积分，支持兑换申请
- ✅ snooze 机制：用户可设置一段时间内不再提示
- ✅ 本地 SQLite：MVP 阶段零成本启动

## 快速开始

```bash
# 安装依赖
pnpm install

# 复制环境变量并填写广告平台配置
cp .env.example .env

# 启动本地服务
pnpm dev
```

服务默认运行在 `http://127.0.0.1:3099`。

## 目录结构

```
ads-platform/
├── server.ts          # Express 后端入口
├── config.ts          # 配置与环境变量
├── db.ts              # SQLite 数据层
├── routes/
│   ├── api.ts         # 积分、兑换、snooze 接口
│   └── postback.ts    # 广告平台回调
├── public/
│   ├── warn.html      # 余额不足落地页
│   └── dashboard.html # 用户积分面板
└── hooks/zcode/       # ZCode hook 示例
```

## Agent 接入

### 1. 在你的 Agent 中配置余额检查

参考 `ads-platform/hooks/zcode/check-balance.js`，当余额/用量低于阈值时打开：

```
http://127.0.0.1:3099/warn.html?provider=...&name=...&balance=...&threshold=...&user=...&type=...
```

### 2. 各 Agent 配置位置

| Agent | Provider 配置位置 |
|---|---|
| ZCode | `~/.zcode/v2/config.json` |
| Claude Code | `~/.claude/config.json` |
| Codex | `~/.codex/config.json` |
| Trae / Cursor | 设置面板或项目配置 |

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
