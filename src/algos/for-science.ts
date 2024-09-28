import { QueryParams } from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import { AppContext } from '../config'
import { AlgoManager } from '../addn/algoManager'
import { BskyAgent } from '@atproto/api'
import dotenv from 'dotenv'
import getListMembers from '../addn/getListMembers'
import getUserLists from '../addn/getUserLists'
import getPostsForUser from '../addn/getPostsForUser'
import resoveDIDToHandle from '../addn/resolveDIDToHandle'
import { Post } from '../db/schema'
import dbClient from '../db/dbClient'

// max 15 chars
export const shortname = 'for-science'

export const handler = async (ctx: AppContext, params: QueryParams) => {
  const builder = await dbClient.getLatestPostsForTag({
    tag: shortname,
    limit: params.limit,
    cursor: params.cursor,
  })

  const feed = builder.map((row) => ({
    post: row.uri,
  }))

  if (feed.length > 3) {
    feed.pop()
    feed.splice(1, 0, {
      post: 'at://did:plc:hu2obebw3nhfj667522dahfg/app.bsky.feed.post/3kl33otd6ob2s',
    })
  }

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
  public authorList: string[]
  public author_collection = 'list_members'

  public async start() {
    this.authorList = await dbClient.getDistinctFromCollection(
      this.author_collection,
      'did',
    )
  }

  public async periodicTask() {
    dotenv.config()

    if (this.authorList === undefined) {
      console.log(`${this.name}: Initialising authors from database`)
      await this.start()
    }

    const lists: string[] = `${process.env.SCIENCE_LISTS}`.split('|')

    if (process.env.SCIENCE_RECURSE === 'true') {
      const list_owners: string[] = []

      for (const list of lists) {
        const members = await getListMembers(list, this.agent)
        members.forEach((member) => {
          if (!list_owners.includes(member)) list_owners.push(member)
        })
      }

      for (const owner of list_owners) {
        const owner_lists = await getUserLists(owner, this.agent)
        const owner_name = await resoveDIDToHandle(owner, this.agent)
        owner_lists.forEach((list) => {
          if (list.name.includes(`${process.env.SCIENCE_SYMBOL}`)) {
            console.log(
              `${this.name}: Adding ${list.name} (${owner_name}) to lists`,
            )
            lists.push(list.atURL)
          }
        })
      }
    }

    console.log(`${this.name}: Watching ${lists.length} lists`)

    let list_members: string[] = []

    for (let i = 0; i < lists.length; i++) {
      const members = await getListMembers(lists[i], this.agent)
      members.forEach((member) => {
        if (!list_members.includes(member)) list_members.push(member)
      })
    }

    if (process.env.BLOCKLIST) {
      const blocked_members: string[] = await getListMembers(
        process.env.BLOCKLIST,
        this.agent,
      )
      list_members = list_members.filter((member) => {
        return !blocked_members.includes(member)
      })
    }

    const db_authors = await dbClient.getDistinctFromCollection(
      this.author_collection,
      'did',
    )

    const new_authors = list_members.filter((member) => {
      return !db_authors.includes(member)
    })
    const del_authors = db_authors.filter((member) => {
      return !list_members.includes(member)
    })

    console.log(
      `${this.name}: Watching ${db_authors.length} + ${new_authors.length} - ${del_authors.length} = ${list_members.length} authors`,
    )

    this.authorList = [...list_members]

    await dbClient.removeTagFromPostsForAuthor(this.name, del_authors)

    for (let i = 0; i < new_authors.length; i++) {
      process.stdout.write(`${this.name}: ${i + 1} of ${new_authors.length}: `)
      const all_posts = await getPostsForUser(new_authors[i], this.agent)

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

      await this.db.replaceOneDID(this.author_collection, new_authors[i], {
        did: new_authors[i],
      })
    }

    del_authors.forEach(async (author) => {
      if (this.agent !== null)
        console.log(
          `${this.name}: Removing ${await resoveDIDToHandle(
            author,
            this.agent,
          )}`,
        )
      await this.db.deleteManyDID(this.author_collection, [author])
    })
  }

  public async filter_post(post: Post): Promise<Boolean> {
    if (
      post.text.toLowerCase().includes(`${process.env.SCIENCE_SYMBOL}`) ||
      post.tags?.includes('science') ||
      post.tags?.includes(`${process.env.SCIENCE_SYMBOL}`)
    ) {
      if (this.authorList.includes(post.author)) {
        return true
      }
    }
    return false
  }
}
