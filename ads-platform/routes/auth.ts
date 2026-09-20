import { Router } from 'express'
import {
  validateUsername,
  createAccount,
  checkLogin,
  createSession,
  setSessionCookie,
  clearSessionCookie,
  getSessionUser,
  destroySession,
} from '../auth.js'

const router = Router()

router.post('/register', (req, res) => {
  const username = String(req.body?.username || '').trim()
  const password = String(req.body?.password || '')

  if (!validateUsername(username)) {
    res.status(400).json({ error: '用户名需为 3-20 位，可含中英文、数字、下划线、连字符' })
    return
  }
  if (password.length < 6) {
    res.status(400).json({ error: '密码至少 6 位' })
    return
  }

  const result = createAccount(username, password)
  if (!result.ok) {
    res.status(409).json({ error: result.reason })
    return
  }

  const token = createSession(username)
  setSessionCookie(res, token)
  res.json({ ok: true, user: username })
})

router.post('/login', (req, res) => {
  const username = String(req.body?.username || '').trim()
  const password = String(req.body?.password || '')

  if (!username || !password) {
    res.status(400).json({ error: '请输入用户名和密码' })
    return
  }

  if (!checkLogin(username, password)) {
    res.status(401).json({ error: '用户名或密码错误' })
    return
  }

  const token = createSession(username)
  setSessionCookie(res, token)
  res.json({ ok: true, user: username })
})

router.post('/logout', (req, res) => {
  destroySession(req)
  clearSessionCookie(res)
  res.json({ ok: true })
})

router.get('/me', (req, res) => {
  res.json({ user: getSessionUser(req) })
})

export default router
