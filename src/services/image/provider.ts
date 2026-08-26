import { resolve } from 'node:path'
import { runPythonScript } from '../../utils/python-runner.js'
import type { GroupPhotoInput, GroupPhotoResult, ImageService, PersonSegment, VideoInput, VideoResult } from './definition.js'

export function createImageProvider(): ImageService {
  return {
    async segmentPerson(photoPath: string, outputDir: string): Promise<PersonSegment> {
      const result = await runPythonScript<PersonSegment>('image_pipeline.py', [
        'segment',
        '--input', resolve(process.cwd(), photoPath),
        '--output-dir', resolve(process.cwd(), outputDir),
      ])
      if (!result.success || !result.data) {
        throw new Error(`segmentPerson failed: ${result.error}`)
      }
      return result.data
    },

    async groupPhoto(input: GroupPhotoInput): Promise<GroupPhotoResult> {
      const args: string[] = [
        'group-photo',
        '--person', resolve(process.cwd(), input.personImagePath),
        '--scene', resolve(process.cwd(), input.scenePath),
        '--output', resolve(process.cwd(), input.outputPath),
      ]
      if (input.yaw !== undefined) args.push('--yaw', String(input.yaw))
      if (input.pitch !== undefined) args.push('--pitch', String(input.pitch))
      if (input.distance !== undefined) args.push('--distance', String(input.distance))
      if (input.scale !== undefined) args.push('--scale', String(input.scale))
      if (input.shadow) args.push('--shadow')
      if (input.lighting) args.push('--lighting')

      const result = await runPythonScript<GroupPhotoResult>('image_pipeline.py', args)
      if (!result.success || !result.data) {
        throw new Error(`groupPhoto failed: ${result.error}`)
      }
      return result.data
    },

    async generateVideo(input: VideoInput): Promise<VideoResult> {
      const args: string[] = [
        'video',
        '--person', resolve(process.cwd(), input.personImagePath),
        '--scene', resolve(process.cwd(), input.scenePath),
        '--output', resolve(process.cwd(), input.outputPath),
      ]
      if (input.durationSeconds !== undefined) args.push('--duration', String(input.durationSeconds))
      if (input.fps !== undefined) args.push('--fps', String(input.fps))
      if (input.motionDescription) args.push('--motion', input.motionDescription)

      const result = await runPythonScript<VideoResult>('video_pipeline.py', args)
      if (!result.success || !result.data) {
        throw new Error(`generateVideo failed: ${result.error}`)
      }
      return result.data
    },
  }
}
