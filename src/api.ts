import { formatTimeAgo } from './lib.ts'
import type { KVNamespace } from '@cloudflare/workers-types'

export async function apiHandler (request: Request, env) {
  const KV: KVNamespace = env.CODSOCIAL
  const u = new URL(request.url)

  if (u.pathname === '/api/submit') {
    const s = new URLSearchParams(u.search)
    const message = s.get('message')
    const now = new Date().getTime() / 1000
    const p = {
      atvid: s.get('atvid'),
      rank: s.get('rank'),
      platform: s.get('platform'),
      hasMic: !!s.get('hasMic'),
      noLife: !!s.get('noLife'),
      party: s.get('party'),
      ttl: Number(s.get('ttl') || 60),
      posted: now,
      message: message && encodeURIComponent(message)
    }

    // TODO: dupe check
    if (p.atvid) {
      console.log('putting into KV')
      await KV.put(`post:${p.atvid}`, JSON.stringify(p), { expirationTtl: p.ttl * 60 })
    }

    return new Response('', {
      status: 302,
      headers: { Location: `/` }
    })
  }

  if (u.pathname === '/api/posts') {
    const list = await KV.list({ prefix: 'post:' })
    const preposts = await Promise.all(list.keys.map(key => KV.get(key.name).then(r => r && JSON.parse(r))))
    const posts = preposts.map(post => ({ ...post, relTime: formatTimeAgo(post.posted) }))

    return new Response(JSON.stringify(posts), { headers: { 'Content-Type': 'application/json' } })
  }

  if (u.pathname === '/api/test') {
    return new Response('', { status: 200 })
  }
}