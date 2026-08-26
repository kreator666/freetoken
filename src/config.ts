import dotenv from 'dotenv'
import { resolve } from 'node:path'

dotenv.config({ path: resolve(process.cwd(), '.env') })

export interface AppConfig {
  deepseekApiKey: string
  deepseekBaseUrl: string
  realseeApiKey?: string
  realseeBaseUrl?: string
  pythonPath: string
  pythonServicePort: number
}

export const config: AppConfig = {
  deepseekApiKey: process.env.DEEPSEEK_API_KEY ?? '',
  deepseekBaseUrl: process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com',
  realseeApiKey: process.env.REALSEE_API_KEY,
  realseeBaseUrl: process.env.REALSEE_BASE_URL,
  pythonPath: process.env.PYTHON_PATH ?? 'python',
  pythonServicePort: Number(process.env.PYTHON_SERVICE_PORT ?? '8765'),
}
