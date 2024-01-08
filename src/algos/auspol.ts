import { QueryParams } from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import { AppContext } from '../config'
import { AlgoManager } from '../addn/algoManager'
import { BskyAgent } from '@atproto/api'
import dotenv from 'dotenv'
import getListMembers from '../addn/getListMembers'
import setListMembers from '../addn/setListMembers'
import getPostsForUser from '../addn/getPostsForUser'
import resoveDIDToHandle from '../addn/resolveDIDToHandle'
import { Post } from '../db/schema'
import dbClient from '../db/dbClient'

dotenv.config()

// max 15 chars
export const shortname = 'auspol'

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
  public author_collection = 'auspol_members'

  public async periodicTask() {
    /*
    dotenv.config()

    const recentPosters = await this.db.getTaggedPostsBetween(
      this.name,
      new Date().getTime(),
      new Date().getTime() - 7 * 24 * 60 * 60 * 1000,
    )
    const db_authors: string[] = []
    recentPosters.forEach((poster) => {
      if (!db_authors.includes(poster.author)) {
        db_authors.push(poster.author)
      }
    })

    const existing_members = await getListMembers(
      `${process.env.AUSPOL_LIST}`,
      this.agent,
    )
    const new_members = db_authors.filter((member) => {
      return !existing_members.includes(member)
    })

    for (let i = 0; i < new_members.length; i++) {
      process.stdout.write(`${this.name}: ${i + 1} of ${new_members.length}: `)

      const all_posts = await getPostsForUser(new_members[i], this.agent)

      const posts: Post[] = []

      for (let i = 0; i < all_posts.length; i++) {
        if ((await this.filter_post(all_posts[i])) == true) {
          posts.push(all_posts[i])
        }
      }

      posts.forEach(async (post) => {
        const existing = await this.db.getPostForURI(post.uri)
        if (existing === null) {
          post.algoTags = [this.name]
          await this.db.replaceOneURI('post', post.uri, post)
        } else {
          const tags = [...new Set([...existing.algoTags, this.name])]
          post.algoTags = tags
          await this.db.replaceOneURI('post', post.uri, post)
        }
      })
    }

    // await setListMembers(`${process.env.AUSPOL_LIST}`, db_authors, this.agent)
    */
  }

  public async filter_post(post: Post): Promise<Boolean> {
    if (['did:plc:ddwwm2jzyq47vvo3tscsozxr'].includes(post.author)) return false
    if (post.text.toLowerCase().includes(`${process.env.AUSPOL_MATCH}`)) {
      return true
    }
    return false
  }
}
