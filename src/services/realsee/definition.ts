import type { SceneMetadata } from '../../types.js'

export type { SceneMetadata }

export interface RealseeService {
  getSceneMetadata(sceneId: string): Promise<SceneMetadata>
  getPanorama(sceneId: string, outputPath: string): Promise<string>
}

export const RealseeServiceSymbol = Symbol.for('realsee.service')
