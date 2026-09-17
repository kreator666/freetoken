import { execSync } from 'node:child_process'
import path from 'node:path'
import { HOME, dirExists, fileExists } from './utils.js'

export interface AgentInfo {
  id: string
  name: string
  detected: boolean
  signals: string[]
}

export function commandExists(cmd: string): boolean {
  try {
    const check = process.platform === 'win32' ? `where ${cmd}` : `command -v ${cmd}`
    execSync(check, { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

interface AgentSignal {
  dir?: string
  file?: string
  command?: string
}

const AGENT_SIGNALS: Array<{ id: string; name: string; signals: AgentSignal[] }> = [
  { id: 'zcode', name: 'ZCode', signals: [{ dir: '.zcode' }, { command: 'zcode' }] },
  { id: 'claude', name: 'Claude Code', signals: [{ command: 'claude' }, { dir: '.claude' }] },
  { id: 'codex', name: 'Codex', signals: [{ command: 'codex' }, { dir: '.codex' }] },
  {
    id: 'cursor',
    name: 'Cursor',
    signals: [{ command: 'cursor' }, { dir: '.cursor' }, { file: '.cursorrules' }],
  },
  { id: 'trae', name: 'Trae', signals: [{ dir: '.trae' }, { command: 'trae' }] },
  {
    id: 'vscode-kimi',
    name: 'VSCode + Kimi Code 插件',
    signals: [{ command: 'code' }, { command: 'code-insiders' }, { dir: '.vscode' }],
  },
  { id: 'kimi-code', name: 'Kimi Code CLI', signals: [{ dir: '.kimi-code' }, { command: 'kimi' }] },
]

export function detectAgents(): AgentInfo[] {
  return AGENT_SIGNALS.map(({ id, name, signals }) => {
    const hit: string[] = []
    for (const signal of signals) {
      if (signal.dir && dirExists(path.join(HOME, signal.dir))) hit.push(`~/${signal.dir}`)
      if (signal.file && fileExists(path.join(HOME, signal.file))) hit.push(`~/${signal.file}`)
      if (signal.command && commandExists(signal.command)) hit.push(`PATH: ${signal.command}`)
    }
    return { id, name, detected: hit.length > 0, signals: hit }
  })
}
