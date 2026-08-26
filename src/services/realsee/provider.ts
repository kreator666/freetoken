import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { config } from '../../config.js'
import type { RealseeService, SceneMetadata } from './definition.js'

/**
 * MVP provider that supports both local/URL panorama fallback and Realsee API.
 */
export function createRealseeProvider(): RealseeService {
  return {
    async getSceneMetadata(sceneId: string): Promise<SceneMetadata> {
      if (sceneId.startsWith('local:') || sceneId.startsWith('http')) {
        return {
          sceneId,
          name: 'MVP fallback scene',
          width: 8192,
          height: 4096,
          format: 'equirectangular',
        }
      }

      if (!config.realseeApiKey) {
        throw new Error('REALSEE_API_KEY is required for real scene lookup')
      }

      const url = new URL(`/api/v1/scenes/${sceneId}`, config.realseeBaseUrl)
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${config.realseeApiKey}` },
      })
      if (!res.ok) {
        throw new Error(`Realsee API error: ${res.status} ${await res.text()}`)
      }
      const data = (await res.json()) as SceneMetadata
      return data
    },

    async getPanorama(sceneId: string, outputPath: string): Promise<string> {
      if (sceneId.startsWith('local:')) {
        return resolve(process.cwd(), sceneId.slice('local:'.length))
      }

      if (sceneId.startsWith('http')) {
        const res = await fetch(sceneId)
        if (!res.ok) throw new Error(`fetch panorama failed: ${res.status}`)
        const buffer = Buffer.from(await res.arrayBuffer())
        const target = resolve(process.cwd(), outputPath)
        await writeFile(target, buffer)
        return target
      }

      if (!config.realseeApiKey) {
        throw new Error('REALSEE_API_KEY is required for real panorama download')
      }

      const meta = await this.getSceneMetadata(sceneId)
      const url = new URL(`/api/v1/scenes/${sceneId}/panorama`, config.realseeBaseUrl)
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${config.realseeApiKey}` },
      })
      if (!res.ok) {
        throw new Error(`Realsee API error: ${res.status} ${await res.text()}`)
      }
      const buffer = Buffer.from(await res.arrayBuffer())
      const target = resolve(process.cwd(), outputPath)
      await writeFile(target, buffer)
      return target
    },
  }
}
