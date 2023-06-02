import { BskyAgent } from '@atproto/api'
import { Database } from '../db'
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
        await agent.login({ identifier: handle, password })
    } catch {
        console.warn("Failed to log in")
        return false
    }

    try {
        const res = await agent.api.app.bsky.graph.getList({list:`${process.env.FEEDGEN_LIST}`})
        
        await db.deleteFrom('list_members').executeTakeFirst()

        res.data.items.forEach(async item => {
            await db.replaceInto('list_members').values({did:item.subject.did}).execute()
        });

    } catch {
        console.warn("Failed to get list")
        return false
    }
    
    return true

}