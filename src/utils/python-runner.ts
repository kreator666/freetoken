import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { config } from '../config.js'

const pythonDir = resolve(process.cwd(), 'python')

export interface PythonScriptResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

export async function runPythonScript<T = unknown>(
  scriptName: string,
  args: string[] = []
): Promise<PythonScriptResult<T>> {
  const scriptPath = resolve(pythonDir, scriptName)
  const child = spawn(config.pythonPath, [scriptPath, ...args], {
    cwd: process.cwd(),
    env: process.env,
  })

  let stdout = ''
  let stderr = ''

  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString()
  })

  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString()
  })

  return new Promise((resolve) => {
    child.on('close', (code) => {
      if (code !== 0) {
        resolve({ success: false, error: stderr || `exit code ${code}` })
        return
      }
      try {
        const lines = stdout.trim().split('\n')
        const jsonLine = lines.find((line) => line.startsWith('{') || line.startsWith('['))
        const data = jsonLine ? (JSON.parse(jsonLine) as T) : undefined
        resolve({ success: true, data })
      } catch (e) {
        resolve({ success: false, error: `parse error: ${(e as Error).message}\nstdout: ${stdout}` })
      }
    })
  })
}
