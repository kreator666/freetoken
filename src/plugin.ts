import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { JsonValue } from '@deepseek-ai/dsh-session'
import { RealseeConsumer } from './services/realsee/consumer.js'
import { ImageConsumer } from './services/image/consumer.js'

export const name = 'dsh-realsee-agent'

export function apply(ctx: Context) {
  // Provide Python-backed services.
  // In production these could be singletons backed by a Python service pool.
  ctx.provide('realsee', new RealseeConsumer())
  ctx.provide('image', new ImageConsumer())

  const realsee = ctx.get('realsee') as RealseeConsumer
  const image = ctx.get('image') as ImageConsumer

  // Register tools into the dsh tool runtime.
  const disposeTools: (() => void)[] = []

  disposeTools.push(
    ctx.tools.register(
      defineTool({
        name: 'realsee_get_scene_metadata',
        description: 'Get metadata for a Realsee VR scene by ID, local:path or http URL',
        parameters: {
          sceneId: { type: 'string', required: true, description: 'Scene identifier' },
        },
        output: {
          schema: { type: 'json' },
          render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
        },
        async execute(args) {
          return realsee.getSceneMetadata(args.sceneId) as unknown as JsonValue
        },
      }),
    ),
  )

  disposeTools.push(
    ctx.tools.register(
      defineTool({
        name: 'realsee_get_panorama',
        description: 'Download or resolve a panorama image for a VR scene',
        parameters: {
          sceneId: { type: 'string', required: true },
          outputPath: { type: 'string', required: true, description: 'Relative path to save the panorama' },
        },
        output: {
          schema: { type: 'string' },
          render: (_args, value) => [{ type: 'text', text: String(value) }],
        },
        async execute(args) {
          return realsee.getPanorama(args.sceneId, args.outputPath)
        },
      }),
    ),
  )

  disposeTools.push(
    ctx.tools.register(
      defineTool({
        name: 'image_segment_person',
        description: 'Extract a person from a photo with alpha mask',
        parameters: {
          photoPath: { type: 'string', required: true },
          outputDir: { type: 'string', required: true },
        },
        output: {
          schema: { type: 'json' },
          render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
        },
        async execute(args) {
          return image.segmentPerson(args.photoPath, args.outputDir) as unknown as JsonValue
        },
      }),
    ),
  )

  disposeTools.push(
    ctx.tools.register(
      defineTool({
        name: 'image_group_photo',
        description: 'Compose a person into a VR panorama to create a group photo',
        parameters: {
          personImagePath: { type: 'string', required: true },
          scenePath: { type: 'string', required: true },
          outputPath: { type: 'string', required: true },
          yaw: { type: 'number' },
          pitch: { type: 'number' },
          distance: { type: 'number' },
          scale: { type: 'number' },
          shadow: { type: 'boolean' },
          lighting: { type: 'boolean' },
        },
        output: {
          schema: { type: 'json' },
          render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
        },
        async execute(args) {
          return image.groupPhoto(args) as unknown as JsonValue
        },
      }),
    ),
  )

  disposeTools.push(
    ctx.tools.register(
      defineTool({
        name: 'image_generate_video',
        description: 'Generate a short video of a person moving inside a VR scene (stage 2)',
        parameters: {
          personImagePath: { type: 'string', required: true },
          scenePath: { type: 'string', required: true },
          outputPath: { type: 'string', required: true },
          durationSeconds: { type: 'number' },
          fps: { type: 'number' },
          motionDescription: { type: 'string' },
        },
        output: {
          schema: { type: 'json' },
          render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
        },
        async execute(args) {
          return image.generateVideo(args) as unknown as JsonValue
        },
      }),
    ),
  )

  return () => {
    for (const dispose of disposeTools) dispose()
  }
}
