import { QueryParams } from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import { AppContext } from '../config'
import { AlgoManager } from '../addn/algoManager'
import { Post } from '../db/schema'
import dbClient from '../db/dbClient'

// max 15 chars
export const shortname = 'discourse'

export const handler = async (ctx: AppContext, params: QueryParams) => {
  const builder = await dbClient.aggregatePostsByReplies(
    'post',
    shortname,
    19,
    params.limit,
    params.cursor,
  )

  const feed = builder
    .sort((a, b) => {
      return b.count - a.count
    })
    .map((row) => ({
      post: row._id,
    }))

  let cursor: string | undefined
  let last = builder.length
  if (params.cursor) last += Number.parseInt(params.cursor)
  if (builder.length > 0) {
    cursor = `${last}`
  }

  return {
    cursor,
    feed,
  }
}

export class manager extends AlgoManager {
  public name: string = shortname

  public async periodicTask() {
    await this.db.removeTagFromOldPosts(
      this.name,
      new Date().getTime() - 7 * 24 * 60 * 1000,
    )
  }

  public async filter_post(post: Post): Promise<Boolean> {
    if (post.replyRoot !== null) {
      return true
    } else {
      return false
    }
  }
}
