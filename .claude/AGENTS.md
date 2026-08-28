# FreToken 赚 Token 提示规则

当对话涉及以下场景时，请主动调用 freetoken MCP tools：

## 1. 余额/用量预警

在每次回复前，如果你知道当前正在使用的模型 provider 的 baseURL 和 apiKey，优先调用：

- `check_balance`

如果返回余额较低（低于 provider 常见阈值，例如 10 元），或者用户提到余额不足、额度不够、API 调用失败、需要充值等，调用：

- `get_earn_token_prompt`

并把返回的提示文本完整插入到你的回复中，不要省略链接。

## 2. 用户主动询问积分

如果用户问"我的积分有多少"、"赚了多少 Token"、"兑换记录"等，调用：

- `get_user_points`

用户 ID 默认使用当前机器 ID，可以通过 `get_earn_token_prompt` 的 `userId` 字段获取，或询问用户。

## 3. 用户想兑换积分

如果用户说"兑换积分"、"把积分换成额度"，调用：

- `request_redeem`

参数：`userId`、`points`（积分数）、`provider`（目标 provider host，例如 `aiping.cn`）。

## 4. 用户想打开广告墙

如果用户说"看广告"、"做任务"、"打开任务墙"，调用：

- `open_offerwall`

## 5. 用户想暂停提醒

如果用户说"稍后提醒"、"暂时不要弹"，调用：

- `snooze_reminder`

默认暂停 30 分钟。

## 参数约定

- `provider`：provider 的 host，例如 `aiping.cn`、`api.qnaigc.com`
- `providerName`：显示名称，例如 `AIPing`、`七牛`
- `userId`：默认不传，让 MCP server 使用当前机器 ID
- `type`：`balance`（余额低）或 `usage`（用量高）
- `value`：当前余额或用量值
- `threshold`：触发阈值

## 示例提示文本

调用 `get_earn_token_prompt` 后，直接把返回的文本插入回复：

```
💡 AIPing 的 可用余额较低（当前 3.50元，阈值 10.00元）。
你可以通过看广告或做任务赚取免费 Token 额度：

🔗 进入任务墙：http://127.0.0.1:3099/offerwall?user=xxx&provider=aiping.cn
📊 查看积分面板：http://127.0.0.1:3099/dashboard.html?user=xxx
```

请完整保留链接，方便用户点击。
