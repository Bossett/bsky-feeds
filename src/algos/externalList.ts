import { QueryParams } from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import { AppContext } from '../config'
import { AlgoManager } from '../addn/algoManager'
import dotenv from 'dotenv'
import { Post } from '../db/schema'
import dbClient from '../db/dbClient'

dotenv.config()

// max 15 chars
let name = 'external'
if (process.env.SECRET_NAME) name = process.env.SECRET_NAME

export const shortname = name

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
  public follows: string[] = []

  async updateList() {
    if (process.env.SECRET_LIST) {
      try {
        const response = await fetch(`${process.env.SECRET_LIST}`)
        const text = await response.text()
        this.follows = text
          .split('\n')
          .filter((item: string) => item.startsWith('did:plc:'))
      } catch {}
    }
  }

  public async periodicTask() {
    this.updateList()

    await this.db.removeTagFromOldPosts(
      this.name,
      new Date().getTime() - 7 * 24 * 60 * 60 * 1000, //7 days
    )
  }

  public async filter_post(post: Post): Promise<Boolean> {
    if (post.replyRoot !== null) return false
    if (this.follows.length === 0) this.updateList()

    if (this.agent === null) {
      await this.start()
    }
    if (this.agent === null) return false

    return this.follows.includes(post.author)
  }
}
