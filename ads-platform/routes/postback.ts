import { Router } from 'express'
import crypto from 'node:crypto'
import { addPoints } from '../db.js'
import { LOOTABLY_SECRET, ADGATE_SECRET, ADGEM_SECRET } from '../config.js'

const router = Router()

// 通用 postback 入口
// Lootably / AdGate / AdGem 都通过 GET 发送回调
router.get('/:provider', (req, res) => {
  const provider = req.params.provider as 'lootably' | 'adgate' | 'adgem'
  const raw = JSON.stringify(req.query)

  if (!['lootably', 'adgate', 'adgem'].includes(provider)) {
    res.status(400).send('0')
    return
  }

  const parsed = parsePostback(provider, req.query)
  if (!parsed) {
    res.status(400).send('0')
    return
  }

  const secret = provider === 'lootably' ? LOOTABLY_SECRET : provider === 'adgate' ? ADGATE_SECRET : ADGEM_SECRET
  if (secret && !verifySignature(provider, parsed, secret, req.query)) {
    console.warn(`[postback:${provider}] signature mismatch`, raw)
    res.status(403).send('0')
    return
  }

  const result = addPoints(parsed.userId, parsed.amount, provider, parsed.transactionId, raw)
  if (!result.ok) {
    console.warn(`[postback:${provider}] rejected: ${result.reason}`, raw)
  }

  // 必须返回 "1" 表示成功，否则广告平台会重试
  res.send('1')
})

interface ParsedPostback {
  userId: string
  amount: number
  transactionId: string
}

function parsePostback(provider: string, q: any): ParsedPostback | null {
  try {
    if (provider === 'lootably') {
      return {
        userId: String(q.user_id || q.userid || q.uid),
        amount: Number(q.amount || q.payout || q.revenue),
        transactionId: String(q.transaction_id || q.txn_id || q.id),
      }
    }
    if (provider === 'adgate') {
      return {
        userId: String(q.user_id || q.userid || q.uid),
        amount: Number(q.amount || q.payout || q.revenue),
        transactionId: String(q.transaction_id || q.txn_id || q.id),
      }
    }
    if (provider === 'adgem') {
      return {
        userId: String(q.user_id || q.userid || q.uid),
        amount: Number(q.amount || q.payout || q.revenue),
        transactionId: String(q.transaction_id || q.txn_id || q.id),
      }
    }
  } catch {
    return null
  }
  return null
}

function verifySignature(provider: string, parsed: ParsedPostback, secret: string, q: any): boolean {
  const signature = String(q.signature || q.sig || q.hash || '')
  if (!signature) return false

  if (provider === 'adgate') {
    // AdGate 常见签名算法：md5(user_id + amount + campaign_id + secret_key)
    const campaignId = String(q.campaign_id || q.offer_id || q.placement_id || '')
    const expected = crypto.createHash('md5').update(`${parsed.userId}${parsed.amount}${campaignId}${secret}`).digest('hex')
    return signature === expected
  }

  if (provider === 'lootably') {
    // Lootably 签名算法需以官方文档为准，这里给出两种常见尝试
    const hmac = crypto.createHmac('sha256', secret).update(`${parsed.userId}:${parsed.amount}:${parsed.transactionId}`).digest('hex')
    const plain = crypto.createHash('sha256').update(`${parsed.userId}${parsed.amount}${parsed.transactionId}${secret}`).digest('hex')
    return signature === hmac || signature === plain
  }

  if (provider === 'adgem') {
    const hmac = crypto.createHmac('sha256', secret).update(`${parsed.userId}:${parsed.amount}:${parsed.transactionId}`).digest('hex')
    return signature === hmac
  }

  return false
}

export default router
