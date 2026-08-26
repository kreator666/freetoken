import type { GroupPhotoInput, GroupPhotoResult, PersonSegment, VideoInput, VideoResult } from '../../types.js'

export type { GroupPhotoInput, GroupPhotoResult, PersonSegment, VideoInput, VideoResult }

export interface ImageService {
  segmentPerson(photoPath: string, outputDir: string): Promise<PersonSegment>
  groupPhoto(input: GroupPhotoInput): Promise<GroupPhotoResult>
  generateVideo(input: VideoInput): Promise<VideoResult>
}

export const ImageServiceSymbol = Symbol.for('image.service')
