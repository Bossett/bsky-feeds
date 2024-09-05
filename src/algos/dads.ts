import { QueryParams } from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import { AppContext } from '../config'
import { AlgoManager } from '../addn/algoManager'
import { BskyAgent } from '@atproto/api'
import dotenv from 'dotenv'
import { Post } from '../db/schema'
import dbClient from '../db/dbClient'
import getUserDetails from '../addn/getUserDetails'

dotenv.config()

const relevantUsers = new Set<string>()
const nonRelevantUsers = new Set<string>()

// max 15 chars
export const shortname = 'dads'

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
  public re = /(?=.*\b(father|dad)\b)/ims

  public async periodicTask() {
    relevantUsers.clear()
    nonRelevantUsers.clear()
    await this.db.removeTagFromOldPosts(
      this.name,
      new Date().getTime() - 7 * 24 * 60 * 60 * 1000,
    )
  }

  public async filter_post(post: Post): Promise<Boolean> {
    if (post.replyRoot !== null) return false

    let return_value: Boolean | undefined = undefined

    let match = false

    if (relevantUsers.has(post.author)) {
      return true
    }

    if (nonRelevantUsers.has(post.author)) {
      return false
    }

    const details = await getUserDetails(post.author, this.agent)

    if (!details || !details.displayName || !details.description) return false

    if (
      `${details.description} ${details.displayName}`.match(this.re) !== null
    ) {
      relevantUsers.add(post.author)
      match = true
    } else {
      nonRelevantUsers.add(post.author)
    }

    if (match) {
      return_value = true
    } else {
      return_value = false
    }

    return return_value
  }
}
