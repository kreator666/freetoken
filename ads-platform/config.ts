import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'

export const PORT = Number(process.env.ADS_PORT || 3099)
export const HOST = process.env.ADS_HOST || '127.0.0.1'

// 数据目录，默认放在 ads-platform/data 下；线上可改为持久化目录
export const DATA_DIR = process.env.ADS_DATA_DIR || path.join(process.cwd(), 'ads-platform', 'data')
export const DB_PATH = path.join(DATA_DIR, 'ads.sqlite')

// Offerwall 配置（MVP 阶段通过环境变量注入）
// 注册 Lootably/AdGate/AdGem 后，把 offerwall URL 和 postback secret 填到 .env
export const LOOTABLY_OFFERWALL_URL = process.env.LOOTABLY_OFFERWALL_URL || ''
export const LOOTABLY_SECRET = process.env.LOOTABLY_SECRET || ''
export const ADGATE_WALL_URL = process.env.ADGATE_WALL_URL || ''
export const ADGATE_SECRET = process.env.ADGATE_SECRET || ''
export const ADGEM_WALL_URL = process.env.ADGEM_WALL_URL || ''
export const ADGEM_SECRET = process.env.ADGEM_SECRET || ''

// 默认 snooze 时长（分钟）
export const DEFAULT_SNOOZE_MINUTES = 30

// 积分汇率：看广告获得的美分直接记为 points（1 point = 0.01 USD）
export const POINTS_PER_DOLLAR = 100

// 每个用户每天最多可获得的积分（防止刷）
export const DAILY_POINTS_CAP = 500 // 5 USD

// 生成跨 Agent 的用户标识
export function getMachineId(): string {
  const info = [os.hostname(), os.userInfo().username, os.platform()].join('|')
  return crypto.createHash('sha256').update(info).digest('hex').slice(0, 16)
}
