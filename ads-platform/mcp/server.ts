import 'dotenv/config'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { exec } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { getPoints, spendPoints, getRedeems, setSnooze, isSnoozed, initDb } from '../db.js'
import { PORT, HOST, getMachineId } from '../config.js'
import { buildEarnTokenPrompt } from '../prompts.js'

function getServerUrl(): string {
  const home = os.homedir()
  const configPaths = [
    path.join(home, '.zcode', 'hooks', 'check-balance.config.json'),
    path.join(process.cwd(), 'ads-platform', 'hooks', 'zcode', 'check-balance.config.json'),
  ]
  for (const p of configPaths) {
    try {
      const raw = fs.readFileSync(p, 'utf-8')
      const config = JSON.parse(raw)
      if (config.serverUrl) return String(config.serverUrl)
    } catch {}
  }
  return `http://${HOST}:${PORT}`
}

const serverUrl = getServerUrl()

// 初始化数据库，确保 MCP server 启动时表已存在
initDb()

const CheckBalanceSchema = z.object({
  baseURL: z.string().url(),
  apiKey: z.string().min(1),
  providerName: z.string().optional(),
})

const EarnTokenPromptSchema = z.object({
  userId: z.string().optional(),
  provider: z.string().min(1),
  providerName: z.string().optional(),
  type: z.enum(['balance', 'usage']).default('balance'),
  value: z.number().default(0),
  threshold: z.number().default(0),
})

const GetUserPointsSchema = z.object({
  userId: z.string().min(1),
})

const RequestRedeemSchema = z.object({
  userId: z.string().min(1),
  points: z.number().positive(),
  provider: z.string().min(1),
})

const SnoozeReminderSchema = z.object({
  userId: z.string().min(1),
  provider: z.string().min(1),
  minutes: z.number().positive().default(30),
})

const OpenOfferwallSchema = z.object({
  userId: z.string().min(1),
  provider: z.string().min(1),
})

async function fetchJSON(url: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(url, init)
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${await res.text()}`)
  }
  return res.json()
}

async function checkOpenAIBalance(baseURL: string, apiKey: string) {
  const endpoints = [
    `${baseURL.replace(/\/$/, '')}/user/balance`,
    `${baseURL.replace(/\/$/, '')}/v1/user/balance`,
  ]
  for (const endpoint of endpoints) {
    try {
      const data = (await fetchJSON(endpoint, {
        headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
      })) as Record<string, unknown>
      if (data.total_available !== undefined) return Number(data.total_available)
      if (data.balance !== undefined) return Number(data.balance)
      if (data.credit !== undefined) return Number(data.credit)
      if (data.total_used !== undefined) return Number(data.total_used)
    } catch {}
  }
  throw new Error('未找到有效的余额接口')
}

async function checkAipingBalance(apiKey: string) {
  const data = (await fetchJSON('https://aiping.cn/api/v1/user/remain/points', {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
  })) as { code: number; msg?: string; data?: { total_remain?: number; recharge_remain?: number; gift_remain?: number } }
  if (data.code !== 0) {
    throw new Error(data.msg || `code ${data.code}`)
  }
  return Number(data.data?.total_remain ?? 0)
}

function openBrowser(url: string) {
  const platform = os.platform()
  let cmd
  if (platform === 'win32') {
    cmd = `start "" "${url}"`
  } else if (platform === 'darwin') {
    cmd = `open "${url}"`
  } else {
    cmd = `xdg-open "${url}"`
  }
  exec(cmd)
}

function getPromptMode(): string {
  const home = os.homedir()
  const configPaths = [
    path.join(home, '.zcode', 'hooks', 'check-balance.config.json'),
    path.join(process.cwd(), 'ads-platform', 'hooks', 'zcode', 'check-balance.config.json'),
  ]
  for (const p of configPaths) {
    try {
      const raw = fs.readFileSync(p, 'utf-8')
      const config = JSON.parse(raw)
      if (config.promptMode) return String(config.promptMode)
    } catch {}
  }
  return 'only-low-balance'
}

const tools: Tool[] = [
  {
    name: 'get_prompt_mode',
    description: '获取当前 FreeToken 赚 Token 提示模式。返回 always / only-low-balance / silent 之一。',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'check_balance',
    description: '检查指定 OpenAI 兼容 provider 的可用余额。支持 aiping.cn 和通用 /user/balance 接口。',
    inputSchema: {
      type: 'object',
      properties: {
        baseURL: { type: 'string', description: 'Provider baseURL，例如 https://aiping.cn' },
        apiKey: { type: 'string', description: 'API Key' },
        providerName: { type: 'string', description: 'Provider 显示名称（可选）' },
      },
      required: ['baseURL', 'apiKey'],
    },
  },
  {
    name: 'get_earn_token_prompt',
    description: '生成标准化的「看广告赚 Token」提示文本，可插入到 Agent 回复中。',
    inputSchema: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: '用户 ID，默认使用当前机器 ID' },
        provider: { type: 'string', description: 'Provider host 或标识' },
        providerName: { type: 'string', description: 'Provider 显示名称' },
        type: { type: 'string', enum: ['balance', 'usage'], description: '预警类型' },
        value: { type: 'number', description: '当前余额或用量值' },
        threshold: { type: 'number', description: '触发阈值' },
      },
      required: ['provider'],
    },
  },
  {
    name: 'get_user_points',
    description: '查询指定用户的当前积分和兑换记录。',
    inputSchema: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: '用户 ID' },
      },
      required: ['userId'],
    },
  },
  {
    name: 'request_redeem',
    description: '申请将积分兑换成 provider token 额度。',
    inputSchema: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: '用户 ID' },
        points: { type: 'number', description: '要兑换的积分数' },
        provider: { type: 'string', description: '目标 provider' },
      },
      required: ['userId', 'points', 'provider'],
    },
  },
  {
    name: 'snooze_reminder',
    description: '设置指定 provider 的赚 Token 提醒暂停时间。',
    inputSchema: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: '用户 ID' },
        provider: { type: 'string', description: 'Provider host 或标识' },
        minutes: { type: 'number', description: '暂停分钟数，默认 30' },
      },
      required: ['userId', 'provider'],
    },
  },
  {
    name: 'open_offerwall',
    description: '打开系统浏览器进入广告任务墙页面。',
    inputSchema: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: '用户 ID' },
        provider: { type: 'string', description: 'Provider host 或标识' },
      },
      required: ['userId', 'provider'],
    },
  },
  {
    name: 'is_snoozed',
    description: '查询指定 provider 的提醒是否处于暂停状态。',
    inputSchema: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: '用户 ID' },
        provider: { type: 'string', description: 'Provider host 或标识' },
      },
      required: ['userId', 'provider'],
    },
  },
]

const server = new Server(
  {
    name: 'freetoken-mcp-server',
    version: '0.1.0',
  },
  {
    capabilities: { tools: {} },
  }
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }))

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  try {
    switch (name) {
      case 'get_prompt_mode': {
        const mode = getPromptMode()
        return {
          content: [{ type: 'text', text: mode }],
          isError: false,
        }
      }

      case 'check_balance': {
        const { baseURL, apiKey, providerName } = CheckBalanceSchema.parse(args)
        const host = new URL(baseURL).hostname.toLowerCase()
        const balance = host === 'aiping.cn'
          ? await checkAipingBalance(apiKey)
          : await checkOpenAIBalance(baseURL, apiKey)
        return {
          content: [
            {
              type: 'text',
              text: `${providerName || host} 当前可用余额：${balance.toFixed(2)}`,
            },
          ],
          isError: false,
        }
      }

      case 'get_earn_token_prompt': {
        const parsed = EarnTokenPromptSchema.parse(args)
        const userId = parsed.userId || getMachineId()
        const prompt = buildEarnTokenPrompt({
          userId,
          providerName: parsed.providerName || parsed.provider,
          providerHost: parsed.provider,
          alertType: parsed.type,
          value: parsed.value,
          threshold: parsed.threshold,
          serverUrl,
        })
        return {
          content: [{ type: 'text', text: prompt }],
          isError: false,
        }
      }

      case 'get_user_points': {
        const { userId } = GetUserPointsSchema.parse(args)
        const points = getPoints(userId)
        const redeems = getRedeems(userId)
        return {
          content: [
            {
              type: 'text',
              text: `用户 ${userId} 当前积分：${points}\n兑换记录：${JSON.stringify(redeems, null, 2)}`,
            },
          ],
          isError: false,
        }
      }

      case 'request_redeem': {
        const { userId, points, provider } = RequestRedeemSchema.parse(args)
        const result = spendPoints(userId, points, provider)
        if (!result.ok) {
          return {
            content: [{ type: 'text', text: `兑换失败：${result.reason}` }],
            isError: true,
          }
        }
        return {
          content: [
            {
              type: 'text',
              text: `兑换申请已提交， redeemId：${result.redeemId}，状态：pending。管理员审核后会向 ${provider} 充值。`,
            },
          ],
          isError: false,
        }
      }

      case 'snooze_reminder': {
        const { userId, provider, minutes } = SnoozeReminderSchema.parse(args)
        const until = setSnooze(userId, provider, minutes)
        return {
          content: [
            {
              type: 'text',
              text: `已暂停 ${provider} 的提醒 ${minutes} 分钟，直到 ${until}`,
            },
          ],
          isError: false,
        }
      }

      case 'is_snoozed': {
        const { userId, provider } = SnoozeReminderSchema.pick({ userId: true, provider: true }).parse(args)
        const snoozed = isSnoozed(userId, provider)
        return {
          content: [{ type: 'text', text: snoozed ? '当前处于暂停提醒状态' : '未暂停提醒' }],
          isError: false,
        }
      }

      case 'open_offerwall': {
        const { userId, provider } = OpenOfferwallSchema.parse(args)
        const url = `${serverUrl}/offerwall?user=${encodeURIComponent(userId)}&provider=${encodeURIComponent(provider)}`
        openBrowser(url)
        return {
          content: [{ type: 'text', text: `已在浏览器中打开任务墙：${url}` }],
          isError: false,
        }
      }

      default:
        return {
          content: [{ type: 'text', text: `未知工具：${name}` }],
          isError: true,
        }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      content: [{ type: 'text', text: `调用失败：${message}` }],
      isError: true,
    }
  }
})

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch((err) => {
  console.error('[freetoken-mcp] fatal:', err)
  process.exit(1)
})
