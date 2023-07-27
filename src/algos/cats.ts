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
export const shortname = 'cats'

export const handler = async (ctx: AppContext, params: QueryParams) => {
  const builder = await dbClient.getLatestPostsForTag(
    shortname,
    params.limit,
    params.cursor,
    true,
    false,
    true,
  )

  let feed = builder.map((row) => ({
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
    /^(?!.*(\b(cat girl|fursuit|fursona|nsfw|cat-like|furryart|doja|dojacat|anthro|anthropomorphic)\b|#furry(art)?)).*\b(cat|catsofbluesky|kitty|kitten|kitties)\b.*$/ims

  public async periodicTask() {
    await this.db.removeTagFromOldPosts(
      this.name,
      new Date().getTime() - 7 * 24 * 60 * 60 * 1000,
    )
  }

  public async filter_post(post: Post): Promise<Boolean> {
    if (post.author === 'did:plc:mcb6n67plnrlx4lg35natk2b') return false // sorry nowbreezing.ntw.app
    if (post.replyRoot !== null) return false
    if (this.agent === null) {
      await this.start()
    }
    if (this.agent === null) return false

    let return_value: Boolean | undefined = undefined

    let match = false

    if (post.embed?.images) {
      const imagesArr = post.embed.images
      imagesArr.forEach((image) => {
        if (`${image.alt}`.replace('\n', ' ').match(this.re) !== null) {
          match = true
        }
      })
    }

    if (`${post.text}`.replace('\n', ' ').match(this.re) !== null) {
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
