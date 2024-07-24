import { formatTimeAgo } from './lib.ts'
import type { KVNamespace } from '@cloudflare/workers-types'

export async function apiHandler(request: Request, env) {
  const KV: KVNamespace = env.CODSOCIAL
  const u = new URL(request.url)

  if (u.pathname === '/api/submit') {
    const s = new URLSearchParams(u.search)
    const now = new Date().getTime() / 1000

    const atvid = s.get('atvid')
    const rank = s.get('rank')
    const platform = s.get('platform')
    const hasMic = !!s.get('hasMic')
    const noLife = !!s.get('noLife')
    const party = s.get('party')
    const ttl = Number(s.get('ttl') || 60)
    const isMuted = !!s.get('isMuted')
    const posted = now
    const message = s.get('message')?.substring(0, 250) || ''

    console.log(atvid)

    // check for valid atvi ids
    if (!atvid || !/[A-Za-z0-9\ ]{2,30}\#[0-9]{2,20}/.test(atvid)) {
      return new Response('', {
        status: 302,
        headers: { Location: `/?error="Invalid Activision ID."` }
      })
    }

    const player = { atvid, rank, platform, hasMic, noLife, party, ttl, isMuted, message, posted }

    // TODO: dupe check
    if (player.atvid) {
      console.log('putting into KV')
      await KV.put(`post:${player.atvid}`, JSON.stringify(player), { expirationTtl: player.ttl * 60 })
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