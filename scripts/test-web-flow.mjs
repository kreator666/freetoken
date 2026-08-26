// Test the full web flow: upload scene, generate group photo with existing person upload.
import { readFile } from 'node:fs/promises'
import { readdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const BASE = 'http://127.0.0.1:3081'
const root = resolve(process.cwd())

async function uploadScene() {
  const buf = await readFile(resolve(root, 'assets/panorama-real.jpg'))
  const form = new FormData()
  form.append('type', 'scene')
  form.append('scene', new Blob([buf], { type: 'image/jpeg' }), 'panorama-real.jpg')
  const res = await fetch(`${BASE}/api/upload`, { method: 'POST', body: form })
  const data = await res.json()
  if (!res.ok) throw new Error('upload failed: ' + JSON.stringify(data))
  console.log('scene uploaded:', data.path)
  return data.path
}

async function findPersonUpload() {
  const dir = resolve(root, 'web/uploads/person')
  const files = await readdir(dir)
  if (files.length === 0) throw new Error('no person upload found in web/uploads/person')
  const file = files[files.length - 1]
  return '/web/uploads/person/' + encodeURIComponent(file)
}

async function generate(personPath, scenePath) {
  const res = await fetch(`${BASE}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personPath,
      scenePath,
      yaw: 0,
      pitch: 0,
      distance: 3,
      shadow: true,
      lighting: true,
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error('generate failed: ' + JSON.stringify(data))
  console.log('generated:', JSON.stringify(data, null, 2))
  return data
}

const scenePath = await uploadScene()
const personPath = await findPersonUpload()
console.log('person:', personPath)
await generate(personPath, scenePath)
