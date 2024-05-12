import {
  getAssetFromKV,
  mapRequestToAsset,
  NotFoundError,
  MethodNotAllowedError,
} from '@cloudflare/kv-asset-handler'
import manifestJSON from '__STATIC_CONTENT_MANIFEST'

import { formatTimeAgo } from './lib.ts'
import type { KVNamespace } from '@cloudflare/workers-types'


const assetManifest = JSON.parse(manifestJSON)



/**
 * The DEBUG flag will do two things that help during development:
 * 1. we will skip caching on the edge, which makes it easier to
 *    debug.
 * 2. we will return an error message on exception in your Response rather
 *    than the default 404.html page.
 */
const DEBUG = false

export default {
  async fetch(request: Request, env, ctx) {
    let options = {}

    const u = new URL(request.url)

    const KV: KVNamespace = env.CODSOCIAL

    if (u.pathname.startsWith('/api')) {

      // TODO: All forms of input validation
      // TODO: unify endpoints, check method
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

    /**
     * You can add custom logic to how we fetch your assets
     * by configuring the function `mapRequestToAsset`
     */
    // options.mapRequestToAsset = handlePrefix(/^\/docs/)

    try {
      if (DEBUG) {
        // customize caching
        options.cacheControl = {
          bypassCache: true,
        }
      }

      const page = await getAssetFromKV(
        {
          request,
          waitUntil(promise) {
            return ctx.waitUntil(promise)
          },
        },
        {
          ASSET_NAMESPACE: env.__STATIC_CONTENT,
          ASSET_MANIFEST: assetManifest,
        }
      )

      // allow headers to be altered
      const response = new Response(page.body, page)

      response.headers.set('X-XSS-Protection', '1; mode=block')
      response.headers.set('X-Content-Type-Options', 'nosniff')
      response.headers.set('X-Frame-Options', 'DENY')
      response.headers.set('Referrer-Policy', 'unsafe-url')
      response.headers.set('Feature-Policy', 'none')

      return response
    } catch (e) {
      if (!DEBUG && e instanceof NotFoundError) {
        let pathname = new URL(request.url).pathname
        return new Response(`"${pathname}" not found`, {
          status: 404,
          statusText: 'not found',
        })
      } else if (e instanceof MethodNotAllowedError) {
        let method = request.method
        return new Response(`Method ${method} not allowed for accessing static assets`, {
          status: 405,
          statusText: 'Method Not Allowed',
        })
      } else {
        return new Response('An unexpected error occured', { status: 500 })
      }
    }
  },
}

