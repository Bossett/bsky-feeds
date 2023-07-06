import { InvalidRequestError } from '@atproto/xrpc-server'
import { QueryParams } from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import { AppContext } from '../config'

// max 15 chars
export const shortname = 'for-science'

export const handler = async (ctx: AppContext, params: QueryParams) => {
  let builder: any[] = []

  if (params.cursor) {
    const [indexedAt, cid] = params.cursor.split('::')
    if (!indexedAt || !cid) {
      throw new InvalidRequestError('malformed cursor')
    }
    const timeStr = new Date(parseInt(indexedAt, 10)).getTime()
    builder = await ctx.db.db().collection("post").find({indexedAt:{$lte:timeStr},cid:{$ne:cid}})
    .sort(
      {
        indexedAt:-1,
        cid:-1
      })
    .limit(params.limit)
    .toArray()

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
