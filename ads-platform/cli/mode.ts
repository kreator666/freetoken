import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import os from 'node:os'
import { readJson, writeJson } from './utils.js'

const HOOK_CONFIG_PATH = path.join(os.homedir(), '.zcode', 'hooks', 'check-balance.config.json')
const PROJECT_CONFIG_PATH = path.join(process.cwd(), 'ads-platform', 'hooks', 'zcode', 'check-balance.config.json')

type PromptMode = 'always' | 'only-low-balance' | 'silent'

const MODE_LABELS: Record<PromptMode, string> = {
  'always': '每次对话都提示',
  'only-low-balance': '仅余额/用量紧张时提示',
  'silent': '彻底静默，只响应手动命令',
}

const VALID_MODES: PromptMode[] = ['always', 'only-low-balance', 'silent']

function isValidMode(mode: string): mode is PromptMode {
  return VALID_MODES.includes(mode as PromptMode)
}

function readConfig() {
  const userConfig = (readJson(HOOK_CONFIG_PATH) || {}) as { promptMode?: string }
  return userConfig
}

function askPromptModeInteractive(): Promise<PromptMode> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })
    console.log('\n🛎️  请选择 FreeToken 赚 Token 提示模式：')
    console.log('  1) always           - 每次对话都提示')
    console.log('  2) only-low-balance - 仅余额/用量紧张时提示（推荐）')
    console.log('  3) silent           - 彻底静默，只响应手动命令')
    rl.question('输入选项 [1/2/3，默认 2]：', (answer) => {
      rl.close()
      const map: Record<string, PromptMode> = {
        '1': 'always',
        '2': 'only-low-balance',
        '3': 'silent',
      }
      const mode = map[answer.trim()] || 'only-low-balance'
      resolve(mode)
    })
  })
}

function updateConfig(mode: PromptMode) {
  // 更新用户级配置
  const userConfig = readJson(HOOK_CONFIG_PATH) || {}
  writeJson(HOOK_CONFIG_PATH, { ...userConfig, promptMode: mode })

  // 同步更新项目级配置（如果存在）
  try {
    if (fs.existsSync(PROJECT_CONFIG_PATH)) {
      const projectConfig = readJson(PROJECT_CONFIG_PATH) || {}
      writeJson(PROJECT_CONFIG_PATH, { ...projectConfig, promptMode: mode })
    }
  } catch {
    // 项目级配置可选
  }
}

export async function setPromptMode(modeArg?: string) {
  let mode: PromptMode

  if (modeArg) {
    if (!isValidMode(modeArg)) {
      console.error(` 无效的模式：${modeArg}`)
      console.error(`可用值：always | only-low-balance | silent`)
      process.exit(1)
    }
    mode = modeArg
  } else {
    const current = readConfig().promptMode
    if (current && isValidMode(current)) {
      console.log(`\n当前提示模式：${current}（${MODE_LABELS[current]}）`)
    } else {
      console.log(`\n当前提示模式：未设置`)
    }
    mode = await askPromptModeInteractive()
  }

  updateConfig(mode)
  console.log(`\n✅ 提示模式已设置为：${mode}（${MODE_LABELS[mode]}）`)
  console.log(`   配置文件：${HOOK_CONFIG_PATH}`)
}
