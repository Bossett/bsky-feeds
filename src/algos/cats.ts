import { QueryParams } from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import { AppContext } from '../config'
import { AlgoManager } from '../addn/algoManager'
import dotenv from 'dotenv'
import { Post } from '../db/schema'
import dbClient from '../db/dbClient'

dotenv.config()

// max 15 chars
export const shortname = 'cats'

export const handler = async (ctx: AppContext, params: QueryParams) => {
  const builder = await dbClient.getLatestPostsForTag({
    tag: shortname,
    limit: params.limit,
    cursor: params.cursor,
    mediaOnly: true,
    nsfwOnly: false,
    excludeNSFW: true,
  })

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
    /^(?!.*((\b(cat( |-)girl|cat( |-)ears|cat( |-)suit|fursona|nsfw|cat-like|furryart|doja|dojacat|anthro|anthropomorphic)\b)|#furry|#furryart|fursuit)).*\b(cat|cats|catsofbluesky|kitty|kitten|kitties)\b.*$/ims

  public async periodicTask() {
    await this.db.removeTagFromOldPosts(
      this.name,
      new Date().getTime() - 7 * 24 * 60 * 60 * 1000,
    )
  }

  public async filter_post(post: Post): Promise<Boolean> {
    if (
      [
        'did:plc:mcb6n67plnrlx4lg35natk2b',
        'did:plc:2rhj4c7tzussdmfcrtlerr7b',
        'did:plc:hw7t2navoastix67wjzrmvof',
      ].includes(post.author)
    )
      return false
    if (post.replyRoot !== null) return false
    if (this.agent === null) {
      await this.start()
    }
    if (this.agent === null) return false

    let return_value: Boolean | undefined = undefined

    let match = false

    let matchString = ''

    if (post.embed?.images) {
      const imagesArr = post.embed.images
      imagesArr.forEach((image) => {
        matchString = `${matchString} ${image.alt}`.replace('\n', ' ')
      })
    }

    if (post.embed?.alt) {
      matchString = `${matchString} ${post.embed.alt}`.replace('\n', ' ')
    }

    if (post.embed?.media?.alt) {
      matchString = `${matchString} ${post.embed?.media?.alt}`.replace(
        '\n',
        ' ',
      )
    }

    if (post.tags) {
      matchString = `${post.tags.join(' ')} ${matchString}`
    }

    matchString = `${post.text} ${matchString}`.replace('\n', ' ')

    if (matchString.match(this.re) !== null) {
      match = true
    }

    return match
  }
}
