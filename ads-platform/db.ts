import path from 'node:path'
import fs from 'node:fs'
import Database from 'better-sqlite3'
import { DB_PATH, DATA_DIR, DAILY_POINTS_CAP } from './config.js'

let db: Database.Database | null = null

export function initDb() {
  if (db) return db
  fs.mkdirSync(DATA_DIR, { recursive: true })
  db = new Database(DB_PATH)

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      points REAL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      provider TEXT,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'USD',
      transaction_id TEXT NOT NULL UNIQUE,
      raw TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS redeems (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      points REAL NOT NULL,
      provider TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS snoozes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      until INTEGER NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, provider)
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
    CREATE INDEX IF NOT EXISTS idx_redeems_user ON redeems(user_id);
  `)

  return db
}

function ensureDb() {
  if (!db) initDb()
  return db!
}

export function getPoints(userId: string): number {
  const db = ensureDb()
  const row = db.prepare('SELECT points FROM users WHERE id = ?').get(userId) as { points: number } | undefined
  return row?.points ?? 0
}

export function addPoints(
  userId: string,
  dollars: number,
  provider: string,
  transactionId: string,
  raw: string
): { ok: true; added: number } | { ok: false; reason: string } {
  const db = ensureDb()

  const existing = db.prepare('SELECT 1 FROM transactions WHERE transaction_id = ?').get(transactionId)
  if (existing) {
    return { ok: false, reason: 'duplicate transaction' }
  }

  const today = new Date().toISOString().slice(0, 10)
  const dailyRow = db
    .prepare(
      `SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND DATE(created_at) = ?`
    )
    .get(userId, today) as { total: number }
  if ((dailyRow?.total ?? 0) + dollars > DAILY_POINTS_CAP / 100) {
    return { ok: false, reason: 'daily cap reached' }
  }

  const insertTx = db.prepare(
    `INSERT INTO transactions (user_id, provider, amount, transaction_id, raw) VALUES (?, ?, ?, ?, ?)`
  )
  const upsertUser = db.prepare(
    `INSERT INTO users (id, points) VALUES (?, ?)
     ON CONFLICT(id) DO UPDATE SET points = points + excluded.points`
  )

  const insertAndAdd = db.transaction(() => {
    insertTx.run(userId, provider, dollars, transactionId, raw)
    upsertUser.run(userId, Math.round(dollars * 100))
  })

  try {
    insertAndAdd()
    return { ok: true, added: Math.round(dollars * 100) }
  } catch (e) {
    return { ok: false, reason: String(e) }
  }
}

export function spendPoints(
  userId: string,
  points: number,
  provider: string
): { ok: true; redeemId: number } | { ok: false; reason: string } {
  const db = ensureDb()
  const current = getPoints(userId)
  if (current < points) {
    return { ok: false, reason: 'insufficient points' }
  }

  const update = db.prepare('UPDATE users SET points = points - ? WHERE id = ?')
  const insert = db.prepare(
    `INSERT INTO redeems (user_id, points, provider, status) VALUES (?, ?, ?, 'pending')`
  )

  const tx = db.transaction(() => {
    update.run(points, userId)
    return insert.run(userId, points, provider).lastInsertRowid as number
  })

  try {
    const redeemId = tx()
    return { ok: true, redeemId }
  } catch (e) {
    return { ok: false, reason: String(e) }
  }
}

export function getRedeems(userId: string) {
  const db = ensureDb()
  return db
    .prepare(
      `SELECT id, points, provider, status, created_at FROM redeems WHERE user_id = ? ORDER BY created_at DESC`
    )
    .all(userId)
}

export function setSnooze(userId: string, provider: string, minutes: number): number {
  const db = ensureDb()
  const until = Date.now() + minutes * 60 * 1000
  db.prepare(
    `INSERT INTO snoozes (user_id, provider, until) VALUES (?, ?, ?)
     ON CONFLICT(user_id, provider) DO UPDATE SET until = excluded.until`
  ).run(userId, provider, until)
  return until
}

export function isSnoozed(userId: string, provider: string): boolean {
  const db = ensureDb()
  const row = db.prepare('SELECT until FROM snoozes WHERE user_id = ? AND provider = ?').get(userId, provider) as
    | { until: number }
    | undefined
  return !!row && Date.now() < row.until
}
