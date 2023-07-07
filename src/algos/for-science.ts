import { InvalidRequestError } from '@atproto/xrpc-server'
import { QueryParams } from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import { AppContext } from '../config'
import { AlgoManager } from '../addn/algoManager'
import { BskyAgent } from '@atproto/api'
import dotenv from 'dotenv'
import getListMembers from '../addn/getListMembers'
import getPostsForUser from '../addn/getPostsForUser'
import resoveDIDToHandle from '../addn/resolveDIDToHandle'
import { Post } from '../db/schema'

// max 15 chars
export const shortname = 'for-science'

export const handler = async (ctx: AppContext, params: QueryParams) => {

  let query:any = {algoTags:shortname}

  if (params.cursor) {
    const [indexedAt, cid] = params.cursor.split('::')
    if (!indexedAt || !cid) {
      throw new InvalidRequestError('malformed cursor')
    }
    const timeStr = new Date(parseInt(indexedAt, 10)).getTime()
    query = {indexedAt:{$lte:timeStr},cid:{$ne:cid},algoTags:shortname}
  }
  const builder = await ctx.db.db().collection("post").find(query)
                      .sort({indexedAt:-1,cid:-1})
                      .limit(params.limit)
                      .toArray()

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

  public name:string = shortname
  public authorList:string[]
  public author_collection = "list_members"

  public agent:BskyAgent|null = null

  public async start() {
    this.authorList = await this.db.db().collection(this.author_collection).distinct("did")
  }

  public async periodicTask() {
    dotenv.config()
    
    if (this.agent === null) {
      this.agent = new BskyAgent({ service: 'https://bsky.social' })

      const handle = `${process.env.FEEDGEN_HANDLE}`
      const password = `${process.env.FEEDGEN_PASSWORD}`

      await this.agent.login({ identifier: handle, password: password })
    }

    const lists:string[] = `${process.env.FEEDGEN_LISTS}`.split("|")
    const list_members:string[] = []

    for(let i=0;i<lists.length;i++){

      if (this.agent !== null) {

        const members = await getListMembers(lists[i],this.agent)
        members.forEach((member)=>{
          if (!list_members.includes(member)) list_members.push(member)
        })

      }
    }

    const db_authors = await this.db.db().collection(this.author_collection).distinct("did")

    const new_authors = list_members.filter((member)=>{return !db_authors.includes(member)})
    const del_authors = db_authors.filter((member)=>{return !list_members.includes(member)})

    console.log(`${db_authors.length} + ${new_authors.length} - ${del_authors.length} = ${list_members.length}`)

    this.authorList = [...list_members]

    const pullQuery: Record<string, any> = {algoTags:{$in:[this.name]}}
    await this.db.db().collection("post").updateMany({author:{$in:del_authors}},{$pull: pullQuery})
    
    for (let i = 0;i<new_authors.length;i++) {
      if (this.agent !== null) {

        process.stdout.write(`${i + 1} of ${new_authors.length}: `)
        const posts = (await getPostsForUser(new_authors[i],this.agent)).filter((post)=>{return this.filter(post)})
        posts.forEach(async (post) => {
          const existing = await this.db.db().collection("post").findOne({"uri":post.uri})
          if (existing === null) {
            post.algoTags = [this.name]
            await this.db.db().collection("post").replaceOne({"uri":post.uri},post,{upsert:true})
          }
          else {
            const tags = [...new Set([...existing.algoTags, this.name])]
            post.algoTags = tags
            await this.db.db().collection("post").replaceOne({"uri":post.uri},post,{upsert:true})
          }
        })
      }

      await this.db.db().collection(this.author_collection).replaceOne({did:new_authors[i]},{did:new_authors[i]},{upsert:true})
    }

    del_authors.forEach(async (author)=>{
      if (this.agent !== null) console.log(`Removing ${await resoveDIDToHandle(author,this.agent)}`)
      await this.db.db().collection(this.author_collection).deleteMany({did:author})
    })

  }

  public filter(post: Post): Boolean {
    
    if (post.text.toLowerCase().includes(`${process.env.FEEDGEN_SYMBOL}`)){
      if (this.authorList.includes(post.author)) {
        console.log(`${post.author} posted ${post.uri}`)
        return true
      }
    }
    return false
  }

}