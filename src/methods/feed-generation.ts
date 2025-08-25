import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../lexicon'
import { AppContext } from '../config'
import algos from '../algos'
import { AtUri } from '@atproto/syntax'
import { OutputSchema as AlgoOutput } from '../lexicon/types/app/bsky/feed/getFeedSkeleton'

const algoCache = new Map<string, { date: number; output: AlgoOutput }>()

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getFeedSkeleton(async ({ params, req, res }) => {
    const feedUri = new AtUri(params.feed)
    const algo = algos[feedUri.rkey].handler
    if (
      //feedUri.hostname !== ctx.cfg.publisherDid ||
      feedUri.collection !== 'app.bsky.feed.generator' ||
      !algo
    ) {
      throw new InvalidRequestError(
        'Unsupported algorithm',
        'UnsupportedAlgorithm',
      )
    }

    const cacheAge = algos[feedUri.rkey].manager.cacheAge(params)
    if (cacheAge.valueOf() > 0) {
      res.setHeader('Cache-Control', `public, max-age=${cacheAge}`)
    } else {
      res.setHeader('Cache-Control', `no-cache`)
    }

    /**
     * Example of how to check auth if giving user-specific results:
     *
     * const requesterDid = await validateAuth(
     *   req,
     *   ctx.cfg.serviceDid,
     *   ctx.didResolver,
     * )
     */

    let body: AlgoOutput | undefined = undefined

    const cacheKey = JSON.stringify(params)

    if (algoCache.has(cacheKey)) {
      const cached = algoCache.get(cacheKey)!
      if (cached.date > Date.now() - 1000 * cacheAge.valueOf()) {
        body = cached.output
      } else {
        algoCache.delete(cacheKey)
      }
    }

    if (body === undefined) {
      body = await algo(ctx, params)
      // Only add to cache if body is defined
      if (body) {
        algoCache.set(cacheKey, { date: Date.now(), output: body })
      }
    }

    // Ensure body is defined before accessing its properties
    if (body && body.feed.length < params.limit) {
      body.cursor = undefined
    }

    // Ensure we never return undefined for body
    if (!body) {
      throw new InvalidRequestError(
        'Failed to generate feed',
        'FeedGenerationError',
      )
    }

    return {
      encoding: 'application/json',
      body: body,
    }
  })
}
