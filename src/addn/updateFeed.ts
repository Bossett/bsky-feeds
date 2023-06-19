import { BskyAgent, ComAtprotoServerListAppPasswords } from '@atproto/api'
import { Database } from '../db'
import { Post } from '../db/schema'
import dotenv from 'dotenv'

import {ObjectId} from 'mongodb'

import crypto from 'crypto'

export class UpdateFeed {

    public db: Database

    constructor(
        db: Database
    ) {
        this.db = db
    }

    async start() {
        dotenv.config()
        console.log("Initial startup, waiting for list...")

        const save_db:Boolean = (`${process.env.FEEDGEN_CLEAR_DB_ON_STARTUP}` === "false")

        let task_inverval_mins = 15

        if (process.env.FEEDGEN_TASK_INTEVAL_MINS !== undefined && 
            Number.parseInt(process.env.FEEDGEN_TASK_INTEVAL_MINS) > 0) {

            task_inverval_mins = Number.parseInt(process.env.FEEDGEN_TASK_INTEVAL_MINS)
        }

        this.updateFeed(!save_db).then((success) => {

            if (success) {
                setInterval(() => {
                    this.updateFeed(false,this.db);
                }, task_inverval_mins*60*1000);
            } else {
                throw new Error("Failed initial data load")
            }

        })
    }

    async updateFeed(reset:Boolean=false,db:Database=this.db) {

        dotenv.config()

        if(reset) await db.db().collection('list_members').deleteMany() // deleteFrom('list_members').executeTakeFirst()
        if(reset) await db.db().collection('post').deleteMany() // deleteFrom('list_members').executeTakeFirst()

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
        
            const existing_members_obj = await db.db().collection('list_members').find().toArray() //.selectFrom('list_members').selectAll().execute()
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

            const session = db.startSession()

            try {
                await session.withTransaction(async () => {
                    await db.db().collection('list_members').deleteMany();
                    await db.db().collection('list_members').insertMany(all_members_obj)
                })
            } finally {
                await session.endSession();
            }
            

            /*await db.transaction().execute(
                async (trx) => {
                    await trx.deleteFrom('list_members').executeTakeFirstOrThrow()
                    await trx.replaceInto('list_members').values(all_members_obj).executeTakeFirstOrThrow()
                }
            )*/

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

                                const hash = crypto.createHash('shake256',{outputLength:12}).update(post.post?.uri).digest('hex').toString()

                                const to_insert: Post = {
                                    _id: new ObjectId(hash),
                                    uri: post.post?.uri,
                                    cid: post.post?.cid,
                                    replyParent: <string> post.reply?.parent.uri ?? null,
                                    replyRoot: <string> post.reply?.root.uri ?? null,
                                    indexedAt: new Date(post.post?.indexedAt).getTime() ?? new Date().getTime()
                                }
                                
                                db.db().collection('post').replaceOne({"uri":to_insert.uri},to_insert,{upsert:true}) // insertInto('post').values(to_insert).onConflict((oc) => oc.doNothing()).executeTakeFirstOrThrow()
                            }
                        }

                        author_feed = await agent.api.app.bsky.feed.getAuthorFeed({actor:author,limit:100,cursor:author_feed.data.cursor})
                    }

                } catch (error) {
                    console.warn(`Failed to get author ${author}`)
                    console.warn(error)
                    return false
                }
            }

        } catch (error) {
            console.warn("Failed to get lists")
            console.warn(error)
            return false
        }
        
        return true

    }

}

export default UpdateFeed