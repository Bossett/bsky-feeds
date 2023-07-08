import { QueryParams } from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import { AppContext } from '../config'
import { AlgoManager } from '../addn/algoManager'
import { BskyAgent } from '@atproto/api'
import dotenv from 'dotenv'
import getListMembers from '../addn/getListMembers'
import getPostsForUser from '../addn/getPostsForUser'
import resoveDIDToHandle from '../addn/resolveDIDToHandle'
import { Post } from '../db/schema'
import dbClient from '../db/dbClient'

// max 15 chars
export const shortname = 'for-science'

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
  public authorList: string[]
  public author_collection = 'list_members'

  public agent: BskyAgent | null = null

  public async start() {
    this.authorList = await dbClient.getDistinctFromCollection(
      this.author_collection,
      'did',
    )
  }

  public async periodicTask() {
    dotenv.config()

    if (this.agent === null) {
      this.agent = new BskyAgent({ service: 'https://bsky.social' })

      const handle = `${process.env.FEEDGEN_HANDLE}`
      const password = `${process.env.FEEDGEN_PASSWORD}`

      await this.agent.login({ identifier: handle, password: password })
    }

    const lists: string[] = `${process.env.SCIENCE_LISTS}`.split('|')
    const list_members: string[] = []

    for (let i = 0; i < lists.length; i++) {
      if (this.agent !== null) {
        const members = await getListMembers(lists[i], this.agent)
        members.forEach((member) => {
          if (!list_members.includes(member)) list_members.push(member)
        })
      }
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

    await dbClient.removeTagFromPosts(this.name, del_authors)

    for (let i = 0; i < new_authors.length; i++) {
      if (this.agent !== null) {
        process.stdout.write(
          `${this.name}: ${i + 1} of ${new_authors.length}: `,
        )
        const posts = (
          await getPostsForUser(new_authors[i], this.agent)
        ).filter((post) => {
          return this.filter_post(post)
        })
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

  public filter_post(post: Post): Boolean {
    if (post.text.toLowerCase().includes(`${process.env.SCIENCE_SYMBOL}`)) {
      if (this.authorList.includes(post.author)) {
        console.log(
          `${this.name}: ${post.uri.split('/').at(-1)} matched for ${
            post.author
          }`,
        )
        return true
      }
    }
    return false
  }
}
