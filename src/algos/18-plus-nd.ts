import { QueryParams } from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import { AppContext } from '../config'
import { AlgoManager } from '../addn/algoManager'
import { BskyAgent } from '@atproto/api'
import dotenv from 'dotenv'
import { Post } from '../db/schema'
import dbClient from '../db/dbClient'
import getUserDetails from '../addn/getUserDetails'

dotenv.config()

// max 15 chars
export const shortname = '18-plus-nd'

export const handler = async (ctx: AppContext, params: QueryParams) => {
  const builder = await dbClient.getLatestPostsForTag(
    shortname,
    params.limit,
    params.cursor,
  )

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

  public agent: BskyAgent | null = null

  public async periodicTask() {
    await this.db.removeTagFromOldPosts(
      this.name,
      new Date().getTime() - 7 * 24 * 60 * 1000,
    )
  }

  public async start() {
    if (this.agent === null) {
      this.agent = new BskyAgent({ service: 'https://bsky.social' })

      const handle = `${process.env.FEEDGEN_HANDLE}`
      const password = `${process.env.FEEDGEN_PASSWORD}`

      await this.agent.login({ identifier: handle, password: password })
    }
  }

  public async filter_post(post: Post): Promise<Boolean> {
    if (this.agent === null) {
      await this.start()
    }
    if (this.agent === null) return false

    let return_value: Boolean | undefined = undefined

    let match = false

    if (
      (await this.db.getRecentAuthorsForTag(this.name)).includes(post.author)
    ) {
      match = true
    } else {
      const details = await getUserDetails(post.author, this.agent)

      const re = RegExp(
        /(?=.*(🔞|18\+|nsfw|mdni))(?=.*\b(autistic|autism|nd|neurodivergent|audhd|autigender|bpd)\b)/,
        'im',
      )

      if (
        `${details.description}`.match(re) !== null ||
        `${details.displayName}`.match(re) !== null
      ) {
        match = true
      }
    }

    if (match) {
      console.log(
        `${this.name}: ${post.uri.split('/').at(-1)} matched for ${
          post.author
        }`,
      )
      return_value = true
    } else {
      return_value = false
    }

    return return_value
  }
}
