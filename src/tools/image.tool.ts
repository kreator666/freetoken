import { ImageConsumer } from '../services/image/consumer.js'
import type { GroupPhotoInput, VideoInput } from '../types.js'

export interface ImageToolContext {
  image: ImageConsumer
}

export const imageTools = {
  name: 'image',
  description: 'Tools for image segmentation and group photo generation in VR scenes',
  tools: [
    {
      name: 'segmentPerson',
      description: 'Extract a person from a photo with alpha mask',
      parameters: {
        type: 'object',
        properties: {
          photoPath: { type: 'string', description: 'Path to the input photo' },
          outputDir: { type: 'string', description: 'Directory to save extracted person and mask' },
        },
        required: ['photoPath', 'outputDir'],
      },
      async handler(ctx: ImageToolContext, args: { photoPath: string; outputDir: string }) {
        return ctx.image.segmentPerson(args.photoPath, args.outputDir)
      },
    },
    {
      name: 'groupPhoto',
      description: 'Compose a person into a VR panorama to create a group photo',
      parameters: {
        type: 'object',
        properties: {
          personImagePath: { type: 'string' },
          scenePath: { type: 'string' },
          outputPath: { type: 'string' },
          yaw: { type: 'number', description: 'Horizontal angle in degrees (-180~180)' },
          pitch: { type: 'number', description: 'Vertical angle in degrees (-90~90)' },
          distance: { type: 'number', description: 'Distance from camera (meters, affects scale)' },
          scale: { type: 'number', description: 'Manual scale override' },
          shadow: { type: 'boolean', description: 'Add ground shadow' },
          lighting: { type: 'boolean', description: 'Apply simple lighting match' },
        },
        required: ['personImagePath', 'scenePath', 'outputPath'],
      },
      async handler(ctx: ImageToolContext, args: GroupPhotoInput) {
        return ctx.image.groupPhoto(args)
      },
    },
    {
      name: 'generateVideo',
      description: 'Generate a short video of a person moving inside a VR scene (stage 2)',
      parameters: {
        type: 'object',
        properties: {
          personImagePath: { type: 'string' },
          scenePath: { type: 'string' },
          outputPath: { type: 'string' },
          durationSeconds: { type: 'number' },
          fps: { type: 'number' },
          motionDescription: { type: 'string' },
        },
        required: ['personImagePath', 'scenePath', 'outputPath'],
      },
      async handler(ctx: ImageToolContext, args: VideoInput) {
        return ctx.image.generateVideo(args)
      },
    },
  ],
}
