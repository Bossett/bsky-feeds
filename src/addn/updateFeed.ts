import { BskyAgent, ComAtprotoServerListAppPasswords } from '@atproto/api'
import { Database } from '../db'
import { Post } from '../db/schema'
import dotenv from 'dotenv'

export default async function udpateFeed(db: Database) {

    dotenv.config()

    const agent = new BskyAgent({ service: 'https://bsky.social' })

    const handle = `${process.env.FEEDGEN_HANDLE}`
    const password = `${process.env.FEEDGEN_PASSWORD}`

    try {
        await agent.login({ identifier: handle, password: password })
    } catch (error) {
        console.warn("Failed to log in")
        console.warn(error)
        return false
    }

    try {
        
        const all_members:string[] = []
        const lists:string[] = `${process.env.FEEDGEN_LISTS}`.split("|")

        while (lists.length > 0) {
            const list = lists.pop()
            const list_members = await agent.api.app.bsky.graph.getList({list:`${list}`})
            list_members.data.items.forEach((member) => {
                if (!all_members.includes(member.subject.did)) all_members.push(member.subject.did)
            })
        }

        const all_members_obj:{did:string}[] = []
        all_members.forEach((member)=>{
            all_members_obj.push({did:member})
        })

        await db.transaction().execute(
            async (trx) => {
                await trx.deleteFrom('list_members').executeTakeFirst()
                await trx.replaceInto('list_members').values(all_members_obj).execute()
            }
        )

        all_members.forEach( async author => {
            try {
                const author_feed = await agent.api.app.bsky.feed.getAuthorFeed({actor:author})

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
                console.warn(`Failed to get author ${author}`)
                console.warn(error)
            }
        })

    } catch (error) {
        console.warn("Failed to get lists")
        console.warn(error)
        return false
    }
    
    return true

}