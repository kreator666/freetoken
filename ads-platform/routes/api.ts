import { Router } from 'express'
import { getPoints, spendPoints, getRedeems, setSnooze, isSnoozed } from '../db.js'

const router = Router()

router.get('/health', (_req, res) => {
  res.json({ ok: true })
})

router.get('/points', (req, res) => {
  const userId = String(req.query.user || '')
  if (!userId) {
    res.status(400).json({ error: 'missing user' })
    return
  }
  const points = getPoints(userId)
  res.json({ userId, points })
})

router.get('/redeems', (req, res) => {
  const userId = String(req.query.user || '')
  if (!userId) {
    res.status(400).json({ error: 'missing user' })
    return
  }
  const redeems = getRedeems(userId)
  res.json({ userId, redeems })
})

router.post('/redeem', (req, res) => {
  const { user, points, provider } = req.body || {}
  const userId = String(user || '')
  const pointsNum = Number(points || 0)
  const providerName = String(provider || 'unknown')

  if (!userId || pointsNum <= 0) {
    res.status(400).json({ error: 'invalid request' })
    return
  }

  const result = spendPoints(userId, pointsNum, providerName)
  if (!result.ok) {
    res.status(400).json({ error: result.reason })
    return
  }

  res.json({ ok: true, redeemId: result.redeemId, status: 'pending' })
})

router.post('/snooze', (req, res) => {
  const userId = String(req.query.user || req.body?.user || '')
  const provider = String(req.query.provider || req.body?.provider || '')
  const minutes = Number(req.query.minutes || req.body?.minutes || 30)

  if (!userId || !provider) {
    res.status(400).json({ error: 'missing user or provider' })
    return
  }

  const until = setSnooze(userId, provider, minutes)
  res.json({ ok: true, until, minutes })
})

router.get('/snooze-check', (req, res) => {
  const userId = String(req.query.user || '')
  const provider = String(req.query.provider || '')
  if (!userId || !provider) {
    res.status(400).json({ error: 'missing user or provider' })
    return
  }
  const snoozed = isSnoozed(userId, provider)
  res.json({ userId, provider, snoozed })
})

export default router
