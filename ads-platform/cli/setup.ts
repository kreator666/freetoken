import fs from 'node:fs'
import readline from 'node:readline'
import path from 'node:path'
import { execSync } from 'node:child_process'
import {
  HOME,
  readJson,
  writeJson,
  copyFile,
  fileExists,
  dirExists,
  findProjectRoot,
  mergeConfig,
} from './utils.js'

interface SetupOptions {
  projectRoot: string
  agents: string[]
}

function getNodeCommand(projectRoot: string): { command: string; args: string[] } {
  return {
    command: 'node',
    args: ['--import', 'tsx', path.join(projectRoot, 'ads-platform/mcp/server.ts')],
  }
}

function installDeps(projectRoot: string) {
  const nodeModules = path.join(projectRoot, 'node_modules')
  if (dirExists(nodeModules)) {
    console.log('✅ 依赖已安装，跳过')
    return
  }
  console.log('📦 安装依赖中...')
  try {
    execSync('pnpm install', { cwd: projectRoot, stdio: 'inherit' })
  } catch {
    console.log('⚠️ pnpm install 失败，尝试 npm install...')
    execSync('npm install', { cwd: projectRoot, stdio: 'inherit' })
  }
}

function setupEnv(projectRoot: string) {
  const envPath = path.join(projectRoot, '.env')
  if (fileExists(envPath)) {
    console.log('✅ .env 已存在，跳过')
    return
  }
  const examplePath = path.join(projectRoot, '.env.example')
  if (fileExists(examplePath)) {
    copyFile(examplePath, envPath)
    console.log('✅ 已从 .env.example 创建 .env')
  } else {
    fs.writeFileSync(
      envPath,
      `# FreeToken 环境变量配置\nADS_PORT=3099\nADS_HOST=127.0.0.1\n\n# 广告墙配置（至少填一个）\nLOOTABLY_OFFERWALL_URL=\nLOOTABLY_SECRET=\nADGATE_WALL_URL=\nADGATE_SECRET=\nADGEM_WALL_URL=\nADGEM_SECRET=\n`
    )
    console.log('✅ 已创建默认 .env')
  }
}

function askPromptMode(): Promise<string> {
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
      const map: Record<string, string> = {
        '1': 'always',
        '2': 'only-low-balance',
        '3': 'silent',
      }
      const mode = map[answer.trim()] || 'only-low-balance'
      console.log(`✅ 已选择模式：${mode}\n`)
      resolve(mode)
    })
  })
}

async function ensurePromptMode(projectRoot: string) {
  const configPath = path.join(projectRoot, 'ads-platform/hooks/zcode/check-balance.config.json')
  const userConfigPath = path.join(HOME, '.zcode', 'hooks', 'check-balance.config.json')
  const config = (readJson(configPath) || {}) as Record<string, unknown>
  const userConfig = (readJson(userConfigPath) || {}) as Record<string, unknown>

  // 如果项目级配置缺少 promptMode，询问并写入
  if (!config.promptMode) {
    config.promptMode = await askPromptMode()
    writeJson(configPath, config)
  }

  // 如果用户级配置缺少 promptMode，同步项目级值
  if (!userConfig.promptMode) {
    userConfig.promptMode = config.promptMode
    writeJson(userConfigPath, userConfig)
  }
}

function setupZCode(projectRoot: string) {
  console.log('\n🛠️  配置 ZCode...')

  const hooksDir = path.join(HOME, '.zcode', 'hooks')
  const cliConfigPath = path.join(HOME, '.zcode', 'cli', 'config.json')

  // 复制 hook 脚本和配置
  copyFile(path.join(projectRoot, 'ads-platform/hooks/zcode/check-balance.js'), path.join(hooksDir, 'check-balance.js'))
  copyFile(path.join(projectRoot, 'ads-platform/hooks/zcode/check-balance.config.json'), path.join(hooksDir, 'check-balance.config.json'))
  console.log('✅ 已复制 ZCode hook 脚本')

  // 写入 ~/.zcode/cli/config.json
  const existing = (readJson(cliConfigPath) || {}) as Record<string, unknown>
  const { command, args } = getNodeCommand(projectRoot)
  const updates = {
    hooks: {
      enabled: true,
      events: {
        SessionStart: [
          {
            matcher: 'startup|resume',
            hooks: [
              {
                type: 'process',
                command: 'node',
                args: [path.join(hooksDir, 'check-balance.js'), 'browser'],
                timeoutMs: 30000,
                statusMessage: '检查模型 provider 余额...',
              },
            ],
          },
        ],
        UserPromptSubmit: [
          {
            matcher: '.*',
            hooks: [
              {
                type: 'process',
                command: 'node',
                args: [path.join(hooksDir, 'check-balance.js'), 'prompt'],
                timeoutMs: 8000,
                statusMessage: '检查余额并准备赚 Token 提示...',
              },
            ],
          },
        ],
      },
    },
    mcp: {
      servers: {
        freetoken: {
          type: 'stdio',
          command,
          args,
          cwd: projectRoot,
        },
      },
    },
  }
  writeJson(cliConfigPath, mergeConfig(existing, updates))
  console.log('✅ 已写入 ZCode MCP 和 hook 配置')
}

function setupClaude(projectRoot: string) {
  const claudeDir = path.join(HOME, '.claude')
  if (!dirExists(claudeDir)) return
  console.log('\n🛠️  配置 Claude Code...')

  const agentsPath = path.join(claudeDir, 'AGENTS.md')
  if (fileExists(agentsPath)) {
    console.log('⚠️  ~/.claude/AGENTS.md 已存在，跳过（避免覆盖个人配置）')
    return
  }
  copyFile(path.join(projectRoot, '.claude/AGENTS.md'), agentsPath)
  console.log('✅ 已写入 ~/.claude/AGENTS.md')
}

function setupCodex(projectRoot: string) {
  const codexDir = path.join(HOME, '.codex')
  if (!dirExists(codexDir)) return
  console.log('\n🛠️  配置 Codex...')

  const instructionsPath = path.join(codexDir, 'instructions.md')
  if (fileExists(instructionsPath)) {
    console.log('⚠️  ~/.codex/instructions.md 已存在，跳过')
    return
  }
  copyFile(path.join(projectRoot, '.codex/instructions.md'), instructionsPath)
  console.log('✅ 已写入 ~/.codex/instructions.md')
}

function setupCursor(projectRoot: string) {
  const cursorRules = path.join(HOME, '.cursorrules')
  if (fileExists(cursorRules)) {
    console.log('\n⚠️  ~/.cursorrules 已存在，跳过')
    return
  }
  console.log('\n🛠️  配置 Cursor...')
  copyFile(path.join(projectRoot, '.cursorrules'), cursorRules)
  console.log('✅ 已写入 ~/.cursorrules')
}

function setupTrae(projectRoot: string) {
  const traeDir = path.join(HOME, '.trae')
  if (!dirExists(traeDir)) return
  console.log('\n🛠️  配置 Trae...')

  const { command, args } = getNodeCommand(projectRoot)
  const configPath = path.join(traeDir, 'mcp_config.json')
  const existing = (readJson(configPath) || {}) as Record<string, unknown>
  const updates = {
    mcpServers: {
      freetoken: {
        command,
        args,
        cwd: projectRoot,
      },
    },
  }
  writeJson(configPath, mergeConfig(existing, updates))
  console.log(`✅ 已写入 ${configPath}`)
  console.log('   如果 Trae 没有自动识别，请在 Trae 设置面板的 MCP / 模型上下文协议中查看')
}

function setupVSCodeKimi(projectRoot: string) {
  const vscodeDir = path.join(HOME, '.vscode')
  if (!dirExists(vscodeDir)) return
  console.log('\n🛠️  配置 VSCode + Kimi Code 插件...')

  const { command, args } = getNodeCommand(projectRoot)
  const settingsPath = path.join(vscodeDir, 'settings.json')
  const existing = (readJson(settingsPath) || {}) as Record<string, unknown>
  // Kimi Code 插件常见的 MCP 配置键名，按优先级尝试写入最可能的键
  const updates = {
    'kimi.mcpServers': {
      freetoken: {
        command,
        args,
        cwd: projectRoot,
      },
    },
  }
  writeJson(settingsPath, mergeConfig(existing, updates))
  console.log(`✅ 已写入 ${settingsPath}（kimi.mcpServers）`)
  console.log('   如果 Kimi Code 没有识别，请检查插件设置里 MCP server 的实际键名，并手动调整')
}

function printNextSteps(projectRoot: string) {
  const { command, args } = getNodeCommand(projectRoot)
  console.log('\n🎉 安装完成！')
  console.log('\n下一步：')
  console.log('1. 编辑 .env 配置广告墙 URL（LOOTABLY_OFFERWALL_URL 等）')
  console.log('2. 启动 HTTP 服务：pnpm dev')
  console.log(`3. 启动 MCP server：${command} ${args.join(' ')}`)
  console.log('4. 完全退出并重新打开你的 Agent（ZCode / Claude Code / Codex / Cursor / Trae / VSCode+Kimi）')
  console.log('5. 在 Agent 中聊天，余额低时会自动出现赚 Token 提示\n')
}

export async function setup(options: Partial<SetupOptions> = {}) {
  const projectRoot = options.projectRoot || findProjectRoot()
  console.log(`\n🔧 FreeToken 一键安装`)
  console.log(`项目目录：${projectRoot}\n`)

  if (!fileExists(path.join(projectRoot, 'package.json'))) {
    console.error('❌ 未找到 freetoken 项目，请确保在 freetoken 目录内运行')
    process.exit(1)
  }

  installDeps(projectRoot)
  setupEnv(projectRoot)
  await ensurePromptMode(projectRoot)
  setupZCode(projectRoot)
  setupClaude(projectRoot)
  setupCodex(projectRoot)
  setupCursor(projectRoot)
  setupTrae(projectRoot)
  setupVSCodeKimi(projectRoot)
  printNextSteps(projectRoot)
}
