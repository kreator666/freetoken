import { upsertPhotos, countPhotos, PhotoRow } from './db.js'

// Lorem Picsum 列表 API：免费、无需 key，返回作者/尺寸信息
// 图片本体走 picsum CDN（https://picsum.photos/id/{id}/{w}/{h}），全球可达
const PICSUM_LIST = 'https://picsum.photos/v2/list?limit=100'

const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000

interface PicsumImage {
  id: string
  author?: string | null
  width?: number | null
  height?: number | null
  url?: string | null
  download_url?: string | null
}

async function fetchPage(page: number): Promise<PhotoRow[]> {
  const res = await fetch(`${PICSUM_LIST}&page=${page}`, {
    headers: { 'User-Agent': 'FreeToken/1.0 (https://freetoken.xin)' },
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new Error(`Picsum HTTP ${res.status}`)
  const results = (await res.json()) as PicsumImage[]

  return (results || [])
    .filter((r) => r.id && r.download_url && (r.width ?? 0) >= (r.height ?? 0))
    .map((r) => ({
      id: `picsum-${r.id}`,
      title: null,
      creator: (r.author || '').slice(0, 80) || null,
      license: null,
      url: r.download_url as string,
      thumbnail: `https://picsum.photos/id/${r.id}/960/420`,
      width: r.width ?? null,
      height: r.height ?? null,
      source: 'picsum',
    }))
}

export async function refreshPhotos(): Promise<number> {
  try {
    const pages = await Promise.all([fetchPage(1), fetchPage(2), fetchPage(3)])
    const rows = pages.flat()
    if (rows.length === 0) return 0
    return upsertPhotos(rows)
  } catch (e) {
    console.warn('[photos] refresh failed, keep existing data:', e)
    return 0
  }
}

// 启动时拉一次，之后每 24 小时增量更新；失败不影响旧数据
export function startPhotoRefresher() {
  refreshPhotos().then((n) => {
    console.log(`[photos] refreshed ${n} photos, total ${countPhotos()}`)
  })
  setInterval(refreshPhotos, REFRESH_INTERVAL_MS).unref()
}
