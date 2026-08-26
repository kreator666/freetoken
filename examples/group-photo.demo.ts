import { createContext } from '../src/index.js'
import { resolve } from 'node:path'

async function main() {
  const ctx = createContext()

  const sceneId = process.env.SCENE_ID ?? 'local:assets/sample-panorama.jpg'
  const photoPath = process.env.PHOTO_PATH ?? 'assets/sample-person.jpg'
  const outputPath = 'assets/output/group-photo.jpg'

  console.log('Step 1: fetch scene panorama')
  const scenePath = await ctx.realsee.getPanorama(sceneId, 'assets/temp/panorama.jpg')
  console.log('  ->', scenePath)

  console.log('Step 2: segment person')
  const segment = await ctx.image.segmentPerson(photoPath, 'assets/temp/person')
  console.log('  ->', segment)

  console.log('Step 3: compose group photo')
  const result = await ctx.image.groupPhoto({
    personImagePath: segment.personImagePath,
    scenePath,
    outputPath,
    yaw: 0,
    pitch: 0,
    distance: 3,
    shadow: true,
    lighting: true,
  })
  console.log('  ->', result)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
