import { QueryParams } from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import { AppContext } from '../config'
import { AlgoManager } from '../addn/algoManager'
import dotenv from 'dotenv'
import { Post } from '../db/schema'
import dbClient from '../db/dbClient'

dotenv.config()

// max 15 chars
export const shortname = 'paxaus'

export const handler = async (ctx: AppContext, params: QueryParams) => {
  const builder = await dbClient.getLatestPostsForTag({
    tag: shortname,
    limit: params.limit,
    cursor: params.cursor,
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

  public matchTerms: string[] = ['pax aus', 'paxaus', 'pax australia']

  public re = new RegExp(
    `^.*\\b(${this.matchTerms.join('|')})(es|s)?\\b.*$`,
    'ims',
  )

  public async periodicTask() {
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
