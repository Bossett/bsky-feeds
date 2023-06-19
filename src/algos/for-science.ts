import { InvalidRequestError } from '@atproto/xrpc-server'
import { QueryParams } from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import { AppContext } from '../config'

// max 15 chars
export const shortname = 'for-science'

export const handler = async (ctx: AppContext, params: QueryParams) => {
  let builder: any[] = []

    /*.selectFrom('post')
    .selectAll()
    .orderBy('indexedAt', 'desc')
    .orderBy('cid', 'desc')
    .limit(params.limit)*/

  if (params.cursor) {
    const [indexedAt, cid] = params.cursor.split('::')
    if (!indexedAt || !cid) {
      throw new InvalidRequestError('malformed cursor')
    }
    const timeStr = new Date(parseInt(indexedAt, 10)).toISOString()
    builder = await ctx.db.db().collection("post").find({indexedAt:{$gte:timeStr},cid:{$lt:cid}})
    .sort(
      {
        indexedAt:-1,
        cid:-1
      })
    .limit(params.limit)
    .toArray()
      /*.where('post.indexedAt', '<', timeStr)
      .orWhere((qb) => qb.where('post.indexedAt', '=', timeStr))
      .where('post.cid', '<', cid)*/
  } else {
    builder =  await ctx.db.db().collection("post").find()
                        .sort(
                          {
                            indexedAt:-1,
                            cid:-1
                          })
                        .limit(params.limit)
                        .toArray()
  }
  //const res = await builder.execute()

  const feed = builder.map((row) => ({
    post: row.uri,
  }))

  let cursor: string | undefined
  const last = builder.at(-1)
  if (last) {
    cursor = `${new Date(last.indexedAt).getTime()}::${last.cid}`
  }

  return {
    cursor,
    feed,
  }
}
