import { RealseeConsumer } from '../services/realsee/consumer.js'

export interface RealseeToolContext {
  realsee: RealseeConsumer
}

export const realseeTools = {
  name: 'realsee',
  description: 'Tools for fetching Realsee VR scenes and panoramas',
  tools: [
    {
      name: 'getSceneMetadata',
      description: 'Get metadata for a Realsee VR scene by scene ID, local:path or http URL',
      parameters: {
        type: 'object',
        properties: {
          sceneId: { type: 'string', description: 'Scene identifier' },
        },
        required: ['sceneId'],
      },
      async handler(ctx: RealseeToolContext, args: { sceneId: string }) {
        return ctx.realsee.getSceneMetadata(args.sceneId)
      },
    },
    {
      name: 'getPanorama',
      description: 'Download or resolve a panorama image for a scene',
      parameters: {
        type: 'object',
        properties: {
          sceneId: { type: 'string', description: 'Scene identifier' },
          outputPath: { type: 'string', description: 'Relative path to save the panorama' },
        },
        required: ['sceneId', 'outputPath'],
      },
      async handler(ctx: RealseeToolContext, args: { sceneId: string; outputPath: string }) {
        return ctx.realsee.getPanorama(args.sceneId, args.outputPath)
      },
    },
  ],
}
