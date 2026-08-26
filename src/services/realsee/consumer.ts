import { createRealseeProvider } from './provider.js'
import type { RealseeService } from './definition.js'

export class RealseeConsumer {
  private service: RealseeService

  constructor(service: RealseeService = createRealseeProvider()) {
    this.service = service
  }

  async getSceneMetadata(sceneId: string) {
    return this.service.getSceneMetadata(sceneId)
  }

  async getPanorama(sceneId: string, outputPath: string) {
    return this.service.getPanorama(sceneId, outputPath)
  }
}
