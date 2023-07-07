import dotenv from 'dotenv'
import { BskyAgent } from '@atproto/api'
import { Post } from '../db/schema'
import { FeedViewPost } from '@atproto/api/dist/client/types/app/bsky/feed/defs'
import crypto from 'crypto'
import { ObjectId } from 'mongodb'

export const getPostsForUser = async (author: string, filter: (post: FeedViewPost) => Boolean, agent:BskyAgent) => {
    dotenv.config()

    const posts:Post[] = []

    let author_feed = await agent.api.app.bsky.feed.getAuthorFeed({actor:author,limit:100})

    while (author_feed.data.feed.length !== 0) {
        const author_posts = author_feed.data.feed
        while (author_posts.length > 0) {
            const post = author_posts.pop()
            if (post === undefined) continue;

            const hash = crypto.createHash('shake256',{outputLength:12}).update(post.post?.uri).digest('hex').toString()

            if (filter(post)) {
                posts.push(
                    {
                        _id: new ObjectId(hash),
                        uri: post.post?.uri,
                        cid: post.post?.cid,
                        replyParent: <string> post.reply?.parent.uri ?? null,
                        replyRoot: <string> post.reply?.root.uri ?? null,
                        indexedAt: new Date(post.post?.indexedAt).getTime() ?? new Date().getTime(),
                        algoTags:[]
                    }
                )
            }
        }
        author_feed = await agent.api.app.bsky.feed.getAuthorFeed({actor:author,limit:100,cursor:author_feed.data.cursor})
    }

    return posts
}

export default getPostsForUser