import { QueryParams } from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import { AppContext } from '../config'
import { AlgoManager } from '../addn/algoManager'
import dotenv from 'dotenv'
import { Post } from '../db/schema'
import dbClient from '../db/dbClient'

dotenv.config()

// max 15 chars
export const shortname = 'overheard'

export const handler = async (ctx: AppContext, params: QueryParams) => {
  const builder = await dbClient.getLatestPostsForTag({
    tag: shortname,
    limit: params.limit,
    cursor: params.cursor,
  })

  const feed = builder.map((row) => {
    let lookup_uri = row.uri

    if (row.embed?.record?.uri) {
      lookup_uri = row.embed.record.uri
    } else {
      if (row.replyParent) lookup_uri = row.replyParent
      else return false
    }
    return { post: lookup_uri }
  })

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

export class manager extends AlgoManager {
  public name: string = shortname
  public re = /^\W*overheard\W*$/ims

  public async filter_post(post: Post): Promise<Boolean> {
    if (post.text.match(this.re)) {
      return true
    }
    return false
  }
}
