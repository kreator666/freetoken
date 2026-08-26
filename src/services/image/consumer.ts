import { createImageProvider } from './provider.js'
import type { GroupPhotoInput, GroupPhotoResult, ImageService, PersonSegment, VideoInput, VideoResult } from './definition.js'

export class ImageConsumer {
  private service: ImageService

  constructor(service: ImageService = createImageProvider()) {
    this.service = service
  }

  async segmentPerson(photoPath: string, outputDir: string): Promise<PersonSegment> {
    return this.service.segmentPerson(photoPath, outputDir)
  }

  async groupPhoto(input: GroupPhotoInput): Promise<GroupPhotoResult> {
    return this.service.groupPhoto(input)
  }

  async generateVideo(input: VideoInput): Promise<VideoResult> {
    return this.service.generateVideo(input)
  }
}
