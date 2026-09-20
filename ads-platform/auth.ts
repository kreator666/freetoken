import crypto from 'node:crypto'
import type { Request, Response } from 'express'
import { initDb } from './db.js'

const SESSION_COOKIE = 'freetoken_session'
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000

// 用户名：3-20 位，允许中英文、数字、下划线、连字符
const USERNAME_RE = /^[\w\u4e00-\u9fa5-]{3,20}$/

function db() {
  return initDb()
}

export function validateUsername(username: string): boolean {
  return USERNAME_RE.test(username)
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `scrypt:${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [algo, salt, hash] = stored.split(':')
  if (algo !== 'scrypt' || !salt || !hash) return false
  const candidate = crypto.scryptSync(password, salt, 64)
  const expected = Buffer.from(hash, 'hex')
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected)
}

export function createAccount(
  username: string,
  password: string
): { ok: true } | { ok: false; reason: string } {
  try {
    db()
      .prepare('INSERT INTO accounts (username, password_hash) VALUES (?, ?)')
      .run(username, hashPassword(password))
    return { ok: true }
  } catch {
    return { ok: false, reason: '用户名已被注册' }
  }
}

export function checkLogin(username: string, password: string): boolean {
  const row = db().prepare('SELECT password_hash FROM accounts WHERE username = ?').get(username) as
    | { password_hash: string }
    | undefined
  if (!row) return false
  return verifyPassword(password, row.password_hash)
}

export function createSession(username: string): string {
  const token = crypto.randomBytes(32).toString('hex')
  db()
    .prepare('INSERT INTO sessions (token, username, expires_at) VALUES (?, ?, ?)')
    .run(token, username, Date.now() + SESSION_TTL_MS)
  return token
}

export function setSessionCookie(res: Response, token: string) {
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`
  )
}

export function clearSessionCookie(res: Response) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`)
}

function readSessionToken(req: Request): string | null {
  const cookies = req.headers.cookie || ''
  const m = cookies.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([a-f0-9]{64})`))
  return m ? m[1] : null
}

export function getSessionUser(req: Request): string | null {
  const token = readSessionToken(req)
  if (!token) return null
  const row = db().prepare('SELECT username, expires_at FROM sessions WHERE token = ?').get(token) as
    | { username: string; expires_at: number }
    | undefined
  if (!row) return null
  if (Date.now() > row.expires_at) {
    db().prepare('DELETE FROM sessions WHERE token = ?').run(token)
    return null
  }
  return row.username
}

export function destroySession(req: Request) {
  const token = readSessionToken(req)
  if (token) {
    db().prepare('DELETE FROM sessions WHERE token = ?').run(token)
  }
}
