import { QueryParams } from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import { AppContext } from '../config'
import { AlgoManager } from '../addn/algoManager'
import { Post } from '../db/schema'
import dbClient from '../db/dbClient'

// max 15 chars
export const shortname = 'discourse'

export const handler = async (ctx: AppContext, params: QueryParams) => {
  const builder = await dbClient.getPostBySortWeight(
    'discourse_posts',
    params.limit,
    params.cursor,
  )

  const feed = builder.map((row) => ({
    post: row._id.toString(),
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

  public threshold = 19

  public static cacheAge(params): Number {
    return 600 // feed does not move fast
  }

  public async periodicTask() {
    await this.db.removeTagFromOldPosts(
      this.name,
      new Date().getTime() - 3 * 24 * 60 * 60 * 1000,
    )
    await dbClient.aggregatePostsByRepliesToCollection(
      'post',
      shortname,
      this.threshold,
      'discourse_posts',
      1000, // top 1000 only
    )

    const discourse_posts = await dbClient.getCollection('discourse_posts')

    let updated = 0

    console.log(`${this.name}: ${discourse_posts.length} posts updating...`)

    for (let i = 0; i < discourse_posts.length; i++) {
      let cursor: string | undefined = ''

      let likes: number = Number.isInteger(discourse_posts[i].likes)
        ? discourse_posts[i].likes
        : 0

      // only check when previous likes are less than current count

      if (likes < discourse_posts[i].count) {
        updated++

        const post = await this.agent.getPostThread({
          uri: 'at://did:plc:vwzwgnygau7ed7b7wt5ux7y2/app.bsky.feed.post/3k2vgp6zxme2k',
          depth: 1,
        })

        const likeCount = Number.parseInt(
          (<any>post.data.thread.post)?.likeCount,
        )
        likes = likeCount
      }

      const record = {
        _id: discourse_posts[i]._id,
        count: discourse_posts[i].count,
        indexedAt: discourse_posts[i].indexedAt,
        likes: likes,
        sort_weight:
          likes > discourse_posts[i].count ? discourse_posts[i].count : likes,
      }

      await dbClient.insertOrReplaceRecord(
        { _id: record._id },
        record,
        'discourse_posts',
      )
    }

    console.log(
      `${this.name}: ${discourse_posts.length} updated (${updated} from server)`,
    )
  }

  public async filter_post(post: Post): Promise<Boolean> {
    if (post.replyRoot !== null) {
      if (post.replyRoot.split('/')[2] != post.author) return true
      else return false
    } else {
      return false
    }
  }
}
