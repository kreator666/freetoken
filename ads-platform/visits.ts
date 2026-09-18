import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { DATA_DIR, DB_PATH } from './config.js'

// 网站访问计数：优先写入 SQLite；数据库不可用时降级为 JSON 文件持久化
const VISITS_FILE = path.join(DATA_DIR, 'visits.json')
const KEY = 'visits'

function readFileCount(): number {
  try {
    const raw = JSON.parse(fs.readFileSync(VISITS_FILE, 'utf-8'))
    return Number(raw.count) || 0
  } catch {
    return 0
  }
}

function writeFileCount(count: number) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  const tmp = VISITS_FILE + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify({ count }))
  fs.renameSync(tmp, VISITS_FILE)
}

function readDbCount(): number {
  const db = new Database(DB_PATH)
  try {
    db.exec(
      `CREATE TABLE IF NOT EXISTS site_stats (key TEXT PRIMARY KEY, value INTEGER NOT NULL DEFAULT 0)`
    )
    const row = db.prepare('SELECT value FROM site_stats WHERE key = ?').get(KEY) as
      | { value: number }
      | undefined
    return row?.value ?? 0
  } finally {
    db.close()
  }
}

function incrementDbCount(): number {
  const db = new Database(DB_PATH)
  try {
    db.exec(
      `CREATE TABLE IF NOT EXISTS site_stats (key TEXT PRIMARY KEY, value INTEGER NOT NULL DEFAULT 0)`
    )
    db.prepare(
      `INSERT INTO site_stats (key, value) VALUES (?, 1)
       ON CONFLICT(key) DO UPDATE SET value = value + 1`
    ).run(KEY)
    const row = db.prepare('SELECT value FROM site_stats WHERE key = ?').get(KEY) as { value: number }
    return row.value
  } finally {
    db.close()
  }
}

export function getVisits(): number {
  try {
    return readDbCount()
  } catch {
    return readFileCount()
  }
}

export function incrementVisits(): number {
  try {
    return incrementDbCount()
  } catch (err) {
    console.warn('[visits] sqlite unavailable, fallback to file:', err)
    const count = readFileCount() + 1
    writeFileCount(count)
    return count
  }
}
