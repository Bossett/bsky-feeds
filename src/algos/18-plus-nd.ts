import { QueryParams } from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import { AppContext } from '../config'
import { AlgoManager } from '../addn/algoManager'
import dotenv from 'dotenv'
import { Post } from '../db/schema'
import dbClient from '../db/dbClient'
import getUserDetails from '../addn/getUserDetails'

dotenv.config()

const relevantUsers = new Set<string>()

// max 15 chars
export const shortname = '18-plus-nd'

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
  public re =
    /(?=.*(🔞|18\+|nsfw|mdni|minors dni))(?=.*\b(autistic|autism|nd|neurodivergent|adhd|audhd|autigender|bpd|neurodistinct|neurodiverse)\b)/ims

  public async periodicTask() {
    relevantUsers.clear()
    await this.db.removeTagFromOldPosts(
      this.name,
      new Date().getTime() - 7 * 24 * 60 * 60 * 1000,
    )
  }

  public async filter_post(post: Post): Promise<Boolean> {
    if (post.replyRoot !== null) return false
    if (this.agent === null) {
      await this.start()
    }
    if (this.agent === null) return false

    let return_value: Boolean | undefined = undefined

    let match = false

    if (relevantUsers.has(post.author)) {
      return true
    }

    const details = await getUserDetails(post.author, this.agent)

    if (!details || !details.displayName || !details.description) return false

    if (
      `${details.displayName} ${details.description}`.match(this.re) !== null
    ) {
      relevantUsers.add(post.author)
      match = true
    }

    if (match) {
      return_value = true
    } else {
      return_value = false
    }

    return return_value
  }
}
