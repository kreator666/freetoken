import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

export const HOME = os.homedir()

export function readJson(p: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'))
  } catch {
    return null
  }
}

export function writeJson(p: string, data: unknown) {
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n')
}

export function copyFile(src: string, dest: string) {
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.copyFileSync(src, dest)
}

export function fileExists(p: string): boolean {
  try {
    return fs.statSync(p).isFile()
  } catch {
    return false
  }
}

export function dirExists(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory()
  } catch {
    return false
  }
}

export function findProjectRoot(): string {
  // 1. 从当前工作目录向上查找 package.json
  let dir = process.cwd()
  while (dir !== path.dirname(dir)) {
    if (fileExists(path.join(dir, 'package.json'))) {
      const pkg = readJson(path.join(dir, 'package.json')) as { name?: string } | null
      if (pkg?.name === 'freetoken') return dir
    }
    dir = path.dirname(dir)
  }

  // 2. 查找 ~/.freetoken
  const homeInstall = path.join(HOME, '.freetoken')
  if (dirExists(homeInstall)) return homeInstall

  // 3. 使用当前工作目录
  return process.cwd()
}

export function mergeConfig(existing: Record<string, unknown>, updates: Record<string, unknown>): Record<string, unknown> {
  const result = { ...existing }
  for (const [key, value] of Object.entries(updates)) {
    if (value && typeof value === 'object' && !Array.isArray(value) && result[key] && typeof result[key] === 'object') {
      result[key] = mergeConfig(result[key] as Record<string, unknown>, value as Record<string, unknown>)
    } else {
      result[key] = value
    }
  }
  return result
}
