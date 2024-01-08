import { QueryParams } from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import { AppContext } from '../config'
import { AlgoManager } from '../addn/algoManager'
import dotenv from 'dotenv'
import { Post } from '../db/schema'
import dbClient from '../db/dbClient'
import getUserFollows from '../addn/getUserFollows'

dotenv.config()

// max 15 chars
export const shortname = 'elusive'

export const handler = async (ctx: AppContext, params: QueryParams) => {
  const builder = await dbClient.getLatestPostsForTag({
    tag: shortname,
    limit: params.limit,
    cursor: params.cursor,
  })

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

export class manager extends AlgoManager {
  public name: string = shortname
  public did = 'did:plc:ywbm3iywnhzep3ckt6efhoh7'
  public follows: string[] = []

  public async periodicTask() {
    this.follows = await getUserFollows(this.did, this.agent)
    await this.db.removeTagFromOldPosts(
      this.name,
      new Date().getTime() - 3 * 24 * 60 * 60 * 1000, //3 days
    )
  }

  public async filter_post(post: Post): Promise<Boolean> {
    if (post.replyRoot !== null) return false
    // getUserFollows is memoised, so this should be fine
    this.follows = await getUserFollows(this.did, this.agent)

    if (this.agent === null) {
      await this.start()
    }
    if (this.agent === null) return false

    return this.follows.includes(post.author)
  }
}
