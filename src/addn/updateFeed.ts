import { BskyAgent, ComAtprotoServerListAppPasswords } from '@atproto/api'
import { Database } from '../db'
import { Post } from '../db/schema'
import dotenv from 'dotenv'

export default async function udpateFeed(db: Database, reset:Boolean=false) {

    dotenv.config()

    if(reset) await db.deleteFrom('list_members').executeTakeFirst()

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
        const old_members:string[] = []
        const new_members:string[] = []

        const lists:string[] = `${process.env.FEEDGEN_LISTS}`.split("|")
       
        const existing_members_obj = await db
                                        .selectFrom('list_members')
                                        .selectAll()
                                        .execute()
        existing_members_obj.forEach((existing_member)=>{
            old_members.push(existing_member.did)
        })

        while (lists.length > 0) {

            const list = lists.pop()

            let total_retrieved = 1
            let current_cursor:string|undefined = undefined

            while (total_retrieved > 0) {
                
                const list_members = await agent.api.app.bsky.graph.getList({list:`${list}`,limit:100,cursor:current_cursor})
                total_retrieved = list_members.data.items.length
                current_cursor = list_members.data.cursor

                list_members.data.items.forEach((member) => {
                    if (!all_members.includes(member.subject.did)) all_members.push(member.subject.did)
                })
            }
        }

        const all_members_obj:{did:string}[] = []

        all_members.forEach((member)=>{
            all_members_obj.push({did:member})

            if(!old_members.includes(member)) {
                new_members.push(member)
            }
        })

        await db.transaction().execute(
            async (trx) => {
                await trx.deleteFrom('list_members').executeTakeFirst()
                await trx.replaceInto('list_members').values(all_members_obj).execute()
            }
        )

        let i = 0
        let total = new_members.length

        while(new_members.length !== 0) {
            
            const author:string = `${new_members.pop()}`

            i++
            console.log(`${i} of ${total}...`)
            
            try {
                let author_feed = await agent.api.app.bsky.feed.getAuthorFeed({actor:author,limit:100})

                while (author_feed.data.feed.length !== 0) {

                    const posts = author_feed.data.feed

                    while (posts.length > 0) {
                        const post = posts.pop()

                        if(post?.post.record['text'].includes(`${process.env.FEEDGEN_SYMBOL}`)) {
                            const to_insert: Post = {
                                uri: post.post?.uri,
                                cid: post.post?.cid,
                                replyParent: <string> post.reply?.parent.uri ?? null,
                                replyRoot: <string> post.reply?.root.uri ?? null,
                                indexedAt: post.post?.indexedAt ?? new Date().toISOString()
                            }
                            db.insertInto('post')
                            .values(to_insert)
                            .onConflict((oc) => oc.doNothing())
                            .execute()
                        }
                    }

                    author_feed = await agent.api.app.bsky.feed.getAuthorFeed({actor:author,limit:100,cursor:author_feed.data.cursor})
                }

            } catch (error) {
                console.warn(`Failed to get author ${author}`)
                console.warn(error)
            }
        }

    } catch (error) {
        console.warn("Failed to get lists")
        console.warn(error)
        return false
    }
    
    return true

}