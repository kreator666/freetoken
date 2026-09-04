import { LOOTABLY_OFFERWALL_URL, ADGATE_WALL_URL, ADGEM_WALL_URL } from './config.js'

export interface PromptContext {
  userId: string
  providerName: string
  providerHost: string
  alertType: 'balance' | 'usage'
  value: number
  threshold: number
  serverUrl: string
  remaining?: number
}

function hasOfferwall(): boolean {
  return Boolean(LOOTABLY_OFFERWALL_URL || ADGATE_WALL_URL || ADGEM_WALL_URL)
}

function formatCurrency(value: number): string {
  return value.toFixed(2)
}

export function buildEarnTokenPrompt(ctx: PromptContext): string {
  const { userId, providerName, alertType, value, threshold, serverUrl } = ctx
  const typeText = alertType === 'usage' ? '24 小时用量' : '可用余额'
  const unit = alertType === 'usage' ? 'kToken' : '元'
  const offerwallUrl = `${serverUrl}/offerwall?user=${encodeURIComponent(userId)}&provider=${encodeURIComponent(ctx.providerHost)}`
  const dashboardUrl = `${serverUrl}/dashboard.html?user=${encodeURIComponent(userId)}`

  if (!hasOfferwall()) {
    return `⚠️ ${providerName} 的 ${typeText}已接近阈值（当前 ${value}${unit}，阈值 ${threshold}${unit}）。
管理员尚未配置广告墙，赚 Token 功能暂不可用。`
  }

  return `💡 ${providerName} 的 ${typeText}较低（当前 ${formatCurrency(value)}${unit}，阈值 ${threshold}${unit}）。
你可以通过看广告或做任务赚取免费 Token 额度：

🔗 进入任务墙：${offerwallUrl}
📊 查看积分面板：${dashboardUrl}

完成任务后积分会自动到账，之后在积分面板申请兑换即可。`
}

export function buildInlineSnoozePrompt(ctx: PromptContext, minutes = 30): string {
  const snoozeUrl = `${ctx.serverUrl}/api/snooze?user=${encodeURIComponent(ctx.userId)}&provider=${encodeURIComponent(ctx.providerHost)}&minutes=${minutes}`
  return `如果你现在不想看广告，可以稍后提醒：[暂停 ${minutes} 分钟](${snoozeUrl})`
}

export function buildAlwaysPrompt(ctx: PromptContext): string {
  const { userId, providerName, providerHost, serverUrl } = ctx
  const offerwallUrl = `${serverUrl}/offerwall?user=${encodeURIComponent(userId)}&provider=${encodeURIComponent(providerHost)}`
  const dashboardUrl = `${serverUrl}/dashboard.html?user=${encodeURIComponent(userId)}`

  if (!hasOfferwall()) {
    return `💡 你可以通过看广告或做任务赚取免费 Token 额度（当前 provider：${providerName}）。
管理员尚未配置广告墙，赚 Token 功能暂不可用。`
  }

  return `💡 你可以通过看广告或做任务赚取免费 Token 额度：

🔗 进入任务墙：${offerwallUrl}
📊 查看积分面板：${dashboardUrl}

完成任务后积分会自动到账，之后在积分面板申请兑换即可。`
}
