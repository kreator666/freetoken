export interface SceneMetadata {
  sceneId: string
  name?: string
  width: number
  height: number
  format: 'equirectangular' | 'cubemap' | 'unknown'
  hotspots?: Hotspot[]
}

export interface Hotspot {
  id: string
  yaw: number
  pitch: number
  label?: string
}

export interface PersonSegment {
  personImagePath: string
  maskPath: string
  originalWidth: number
  originalHeight: number
}

export interface GroupPhotoInput {
  personImagePath: string
  scenePath: string
  outputPath: string
  yaw?: number
  pitch?: number
  distance?: number
  scale?: number
  shadow?: boolean
  lighting?: boolean
}

export interface GroupPhotoResult {
  outputPath: string
  outputFormat: string
  width: number
  height: number
}

export interface VideoInput {
  personImagePath: string
  scenePath: string
  outputPath: string
  durationSeconds?: number
  fps?: number
  motionDescription?: string
}

export interface VideoResult {
  outputPath: string
  durationSeconds: number
  fps: number
  width: number
  height: number
}
