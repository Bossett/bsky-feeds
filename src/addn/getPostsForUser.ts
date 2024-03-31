import dotenv from 'dotenv'
import { BskyAgent } from '@atproto/api'
import { Post } from '../db/schema'

import crypto from 'crypto'
import resolveDIDToHandle from './resolveDIDToHandle'
import limit from './rateLimit'

export const getPostsForUser = async (
  author: string,
  agent: BskyAgent,
): Promise<Post[]> => {
  dotenv.config()

  const posts: Post[] = []

  console.log(
    `Getting posts for ${await resolveDIDToHandle(author, agent)}... `,
  )

  let author_feed = await limit(() =>
    agent.api.app.bsky.feed.getAuthorFeed({
      actor: author,
      limit: 100,
    }),
  )

  do {
    const author_posts = author_feed.data.feed
    while (author_posts.length > 0) {
      const post_create = author_posts.pop()
      if (post_create === undefined) continue

      const post: Post = {
        _id: null,
        uri: post_create.post?.uri,
        cid: post_create.post?.cid,
        author: author,
        text: post_create.post?.record['text'],
        replyParent: <string>post_create.reply?.parent.uri ?? null,
        replyRoot: <string>post_create.reply?.root.uri ?? null,
        indexedAt:
          new Date(post_create.post?.indexedAt).getTime() ??
          new Date().getTime(),
        algoTags: null,
      }

      const hash = crypto
        .createHash('shake256', { outputLength: 12 })
        .update(post.uri)
        .digest('hex')
        .toString()
      post._id = hash

      posts.push(post)
    }
    author_feed = await limit(() =>
      agent.api.app.bsky.feed.getAuthorFeed({
        actor: author,
        limit: 100,
        cursor: author_feed.data.cursor,
      }),
    )
  } while (
    author_feed.data.cursor !== undefined &&
    author_feed.data.cursor !== ''
  )

  return posts
}

export default getPostsForUser
