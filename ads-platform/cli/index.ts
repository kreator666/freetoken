import { setup } from './setup.js'

const args = process.argv.slice(2)
const command = args[0] || 'setup'

async function main() {
  switch (command) {
    case 'setup':
      await setup({
        projectRoot: process.env.FREETOKEN_ROOT,
      })
      break
    case 'help':
    case '--help':
    case '-h':
      console.log(`
FreToken CLI

用法：
  freetoken setup       一键安装并配置 Agent
  freetoken help        显示帮助

环境变量：
  FREETOKEN_ROOT        指定 freetoken 项目根目录
`)
      break
    default:
      console.error(`❌ 未知命令：${command}`)
      console.error('可用命令：setup, help')
      process.exit(1)
  }
}

main().catch((err) => {
  console.error('❌ 错误：', err.message)
  process.exit(1)
})
