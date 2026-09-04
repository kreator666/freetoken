import { setup } from './setup.js'
import { setPromptMode } from './mode.js'

const args = process.argv.slice(2)
const command = args[0] || 'setup'

async function main() {
  switch (command) {
    case 'setup':
      await setup({
        projectRoot: process.env.FREETOKEN_ROOT,
      })
      break
    case 'mode':
      await setPromptMode(args[1])
      break
    case 'help':
    case '--help':
    case '-h':
      console.log(`
FreeToken CLI

用法：
  freetoken setup       一键安装并配置 Agent
  freetoken mode        交互式修改提示模式
  freetoken mode <值>   直接设置提示模式（always / only-low-balance / silent）
  freetoken help        显示帮助

环境变量：
  FREETOKEN_ROOT        指定 freetoken 项目根目录
`)
      break
    default:
      console.error(` 未知命令：${command}`)
      console.error('可用命令：setup, mode, help')
      process.exit(1)
  }
}

main().catch((err) => {
  console.error(' 错误：', err.message)
  process.exit(1)
})

