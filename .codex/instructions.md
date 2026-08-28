# FreToken 赚 Token 提示规则

When any of the following situations occur, actively call the freetoken MCP tools:

## 1. Balance / usage warning

Before every response, if you know the current model provider's baseURL and apiKey, call:

- `check_balance`

If the returned balance is low (below the common provider threshold, e.g. 10 yuan), or the user mentions low balance, insufficient quota, API call failures, or needs to recharge, call:

- `get_earn_token_prompt`

Insert the returned prompt text into your reply verbatim, without omitting any links.

## 2. User asks about points

If the user asks "how many points do I have", "how many Tokens have I earned", "redemption history", etc., call:

- `get_user_points`

The default `userId` is the current machine ID, which can be obtained from the `userId` field of `get_earn_token_prompt`, or you may ask the user.

## 3. User wants to redeem points

If the user says "redeem points", "convert points to quota", call:

- `request_redeem`

Parameters: `userId`, `points` (positive number), `provider` (target provider host, e.g. `aiping.cn`).

## 4. User wants to open the offerwall

If the user says "watch ads", "do tasks", "open offerwall", call:

- `open_offerwall`

## 5. User wants to snooze reminders

If the user says "remind me later", "don't show this now", call:

- `snooze_reminder`

Default snooze duration is 30 minutes.

## Parameter conventions

- `provider`: provider host, e.g. `aiping.cn`, `api.qnaigc.com`
- `providerName`: display name, e.g. `AIPing`, `七牛`
- `userId`: omit to let the MCP server use the current machine ID
- `type`: `balance` (low balance) or `usage` (high usage)
- `value`: current balance or usage value
- `threshold`: trigger threshold

## Example prompt text

After calling `get_earn_token_prompt`, insert the returned text directly into your reply:

```
💡 AIPing balance is low (current 3.50 yuan, threshold 10.00 yuan).
Earn free Token quota by watching ads or completing tasks:

🔗 Offerwall: http://127.0.0.1:3099/offerwall?user=xxx&provider=aiping.cn
📊 Dashboard: http://127.0.0.1:3099/dashboard.html?user=xxx
```

Keep the links intact so the user can click them.
