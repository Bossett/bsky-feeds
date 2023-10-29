import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../lexicon'
import { AppContext } from '../config'
import algos from '../algos'
import { validateAuth } from '../auth'
import { AtUri } from '@atproto/syntax'
import moize from 'moize'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getFeedSkeleton(async ({ params, req, res }) => {
    const feedUri = new AtUri(params.feed)
    const algo = algos[feedUri.rkey].handler
    if (
      feedUri.hostname !== ctx.cfg.publisherDid ||
      feedUri.collection !== 'app.bsky.feed.generator' ||
      !algo
    ) {
      throw new InvalidRequestError(
        'Unsupported algorithm',
        'UnsupportedAlgorithm',
      )
    }

    const cacheAge = algos[feedUri.rkey].manager.cacheAge(params)
    if (cacheAge > 0) {
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

    const algoHandlerMoized = moize(algo, {
      isPromise: true,
      maxAge: 30, // 30 seconds
      updateExpire: true,
      isShallowEqual: true,
    })

    const body = await algoHandlerMoized(ctx, params)
    return {
      encoding: 'application/json',
      body: body,
    }
  })
}
