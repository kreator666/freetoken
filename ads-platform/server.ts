import 'dotenv/config'
import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { initDb } from './db.js'
import { PORT, HOST, LOOTABLY_OFFERWALL_URL, ADGATE_WALL_URL, ADGEM_WALL_URL } from './config.js'
import apiRouter from './routes/api.js'
import postbackRouter from './routes/postback.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// 让前端能读取当前配置的 offerwall URL
app.get('/api/config', (_req, res) => {
  res.json({
    lootablyOfferwallUrl: LOOTABLY_OFFERWALL_URL,
    adgateWallUrl: ADGATE_WALL_URL,
    adgemWallUrl: ADGEM_WALL_URL,
  })
})

// offerwall 落地页：服务器把用户 ID 注入 HTML，避免把 secret 暴露给客户端
app.get('/offerwall', (req, res) => {
  const userId = String(req.query.user || '')
  const provider = String(req.query.provider || '')
  const wallUrl = LOOTABLY_OFFERWALL_URL || ADGATE_WALL_URL || ADGEM_WALL_URL || ''
  const separator = wallUrl.includes('?') ? '&' : '?'
  const fullUrl = wallUrl ? `${wallUrl}${separator}user_id=${encodeURIComponent(userId)}` : ''

  res.send(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>赚取 Token 积分</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; }
    h1 { color: #333; }
    .box { border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin-top: 20px; background: #fafafa; }
    iframe { width: 100%; height: 600px; border: 1px solid #ddd; border-radius: 4px; margin-top: 16px; }
    .empty { color: #888; }
    a { color: #0066cc; }
  </style>
</head>
<body>
  <h1>看广告 / 做任务赚积分</h1>
  <p>当前用户：<code>${userId}</code> · Provider：<code>${provider || 'default'}</code></p>
  <div class="box">
    <p>完成任务后积分会自动到账。可在 <a href="/dashboard.html?user=${encodeURIComponent(userId)}">积分面板</a> 查看。</p>
    ${fullUrl
      ? `<iframe src="${fullUrl}" allow="clipboard-write"></iframe>`
      : '<p class="empty">⚠️ 管理员尚未配置广告墙 URL，请在 .env 中设置 LOOTABLY_OFFERWALL_URL 等环境变量。</p>'}
  </div>
</body>
</html>`)
})

app.use('/api', apiRouter)
app.use('/postback', postbackRouter)
app.use(express.static(path.join(__dirname, 'public')))

async function main() {
  initDb()
  app.listen(PORT, HOST, () => {
    console.log(`[ads-platform] server running at http://${HOST}:${PORT}`)
    console.log(`[ads-platform] postback endpoint: http://${HOST}:${PORT}/postback/:provider`)
    console.log(`[ads-platform] warn page: http://${HOST}:${PORT}/warn.html`)
  })
}

main().catch((err) => {
  console.error('[ads-platform] failed to start:', err)
  process.exit(1)
})
