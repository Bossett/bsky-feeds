import { BskyAgent } from '@atproto/api'
import { Database } from '../db'
import { Post } from '../db/schema'
import dotenv from 'dotenv'

export default async function udpateFeed(db: Database) {

    dotenv.config()

    const agent = new BskyAgent({ service: 'https://bsky.social' })

    // YOUR bluesky handle
    // Ex: user.bsky.social
    const handle = `${process.env.FEEDGEN_HANDLE}`

    // YOUR bluesky password, or preferably an App Password (found in your client settings)
    // Ex: abcd-1234-efgh-5678
    const password = `${process.env.FEEDGEN_PASSWORD}`

    try {
        await agent.login({ identifier: handle, password: password })
    } catch (error) {
        console.warn("Failed to log in")
        console.warn(error)
        return false
    }

    try {
        const res = await agent.api.app.bsky.graph.getList({list:`${process.env.FEEDGEN_LIST}`})
        
        await db.deleteFrom('list_members').executeTakeFirst()

        res.data.items.forEach(async item => {
            await db.replaceInto('list_members').values({did:item.subject.did}).execute()
            try {
                const author_feed = await agent.api.app.bsky.feed.getAuthorFeed({actor:item.subject.did})
                
                author_feed.data.feed.forEach(async item => {
                    
                    if ((<any> item.post)?.record.text.includes(`${process.env.FEEDGEN_SYMBOL}`)) {
                    
                        const to_insert: Post = {
                            uri: item.post?.uri,
                            cid: item.post?.cid,
                            replyParent: <string> item.reply?.parent.uri ?? null,
                            replyRoot: <string> item.reply?.root.uri ?? null,
                            indexedAt: item.post?.indexedAt ?? new Date().toISOString()
                        }
                        await db
                            .insertInto('post')
                            .values(to_insert)
                            .onConflict((oc) => oc.doNothing())
                            .execute()
                    }
                });
            } catch (error) {
                console.warn("Failed to get historic posts")
                console.warn(error)
            }
        });

    } catch (error) {
        console.warn("Failed to get list")
        console.warn(error)
        return false
    }


    
    return true

}