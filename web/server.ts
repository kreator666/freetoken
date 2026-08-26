import { createServer } from 'node:http'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync, createReadStream } from 'node:fs'
import { resolve, extname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import formidable from 'formidable'
import { RealseeConsumer } from '../src/services/realsee/consumer.js'
import { ImageConsumer } from '../src/services/image/consumer.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const rootDir = resolve(__dirname, '..')
const webDir = resolve(__dirname)
const publicDir = resolve(webDir, 'public')
const uploadDir = resolve(webDir, 'uploads')
const outputDir = resolve(webDir, 'output')

const PORT = Number(process.env.WEB_PORT ?? '3081')

const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
}

async function ensureDirs() {
  for (const dir of [uploadDir, resolve(uploadDir, 'person'), resolve(uploadDir, 'scene'), outputDir]) {
    await mkdir(dir, { recursive: true })
  }
}

const realsee = new RealseeConsumer()
const image = new ImageConsumer()

function sendJson(res: any, status: number, data: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

function serveStatic(res: any, filePath: string) {
  const ext = extname(filePath)
  const mime = MIME[ext] ?? 'application/octet-stream'
  const stream = createReadStream(filePath)
  res.writeHead(200, { 'Content-Type': mime })
  stream.pipe(res)
  stream.on('error', () => {
    res.writeHead(404)
    res.end('Not found')
  })
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`)
  const pathname = url.pathname

  try {
    if (pathname === '/' || pathname === '/index.html') {
      const html = await readFile(resolve(publicDir, 'index.html'), 'utf-8')
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(html)
      return
    }

    if (pathname.startsWith('/output/')) {
      const file = resolve(outputDir, basename(pathname))
      if (existsSync(file)) {
        serveStatic(res, file)
      } else {
        res.writeHead(404)
        res.end('Not found')
      }
      return
    }

    if (pathname === '/api/upload' && req.method === 'POST') {
      const form = formidable({
        uploadDir,
        keepExtensions: true,
        maxFileSize: 50 * 1024 * 1024,
      })
      const [fields, files] = await form.parse(req)
      const type = Array.isArray(fields.type) ? fields.type[0] : fields.type
      const uploaded = type === 'person' ? files.person?.[0] : files.scene?.[0]
      if (!uploaded) {
        sendJson(res, 400, { error: 'missing file' })
        return
      }
      const targetDir = resolve(uploadDir, type === 'person' ? 'person' : 'scene')
      await mkdir(targetDir, { recursive: true })
      const targetName = `${Date.now()}_${uploaded.originalFilename ?? basename(uploaded.filepath)}`
      const targetPath = resolve(targetDir, targetName)
      await writeFile(targetPath, await readFile(uploaded.filepath))
      sendJson(res, 200, { path: targetPath.replace(rootDir, '').replace(/\\/g, '/') })
      return
    }

    if (pathname === '/api/generate' && req.method === 'POST') {
      const body = await new Promise<string>((resolve, reject) => {
        let data = ''
        req.on('data', (chunk) => (data += chunk))
        req.on('end', () => resolve(data))
        req.on('error', reject)
      })
      const params = JSON.parse(body)
      const personPath = resolve(rootDir, decodeURIComponent(params.personPath.replace(/^\//, '')).replace(/\//g, '\\'))
      const scenePath = params.scenePath.startsWith('http') || params.scenePath.startsWith('local:')
        ? params.scenePath
        : resolve(rootDir, decodeURIComponent(params.scenePath.replace(/^\//, '')).replace(/\//g, '\\'))

      // Segment person first
      const segment = await image.segmentPerson(personPath, 'web/temp/person')

      // Resolve scene panorama
      const resolvedScenePath = scenePath.startsWith('local:') || scenePath.startsWith('http')
        ? await realsee.getPanorama(scenePath, 'web/temp/panorama.jpg')
        : scenePath

      // Generate output filename
      const outputName = `group-photo-${Date.now()}.jpg`
      const outputPath = resolve(outputDir, outputName)

      const result = await image.groupPhoto({
        personImagePath: segment.personImagePath,
        scenePath: resolvedScenePath,
        outputPath,
        yaw: params.yaw ?? 0,
        pitch: params.pitch ?? 0,
        distance: params.distance ?? 3,
        scale: params.scale,
        shadow: params.shadow ?? true,
        lighting: params.lighting ?? true,
      })

      sendJson(res, 200, {
        ...result,
        previewUrl: `/output/${outputName}`,
      })
      return
    }

    res.writeHead(404)
    res.end('Not found')
  } catch (error) {
    console.error(error)
    sendJson(res, 500, { error: (error as Error).message })
  }
})

await ensureDirs()
server.listen(PORT, () => {
  console.log(`Web UI running at http://127.0.0.1:${PORT}`)
})
