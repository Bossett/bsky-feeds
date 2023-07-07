import { InvalidRequestError } from '@atproto/xrpc-server'
import { QueryParams } from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import { AppContext } from '../config'
import { AlgoManager } from '../addn/algoManager'
import { BskyAgent } from '@atproto/api'
import dotenv from 'dotenv'
import getListMembers from '../addn/getListMembers'
import getPostsForUser from '../addn/getPostsForUser'

// max 15 chars
export const shortname = 'for-science'

export const handler = async (ctx: AppContext, params: QueryParams) => {
  let builder: any[] = []

  if (params.cursor) {
    const [indexedAt, cid] = params.cursor.split('::')
    if (!indexedAt || !cid) {
      throw new InvalidRequestError('malformed cursor')
    }
    const timeStr = new Date(parseInt(indexedAt, 10)).getTime()
    builder = await ctx.db.db().collection("post").find({indexedAt:{$lte:timeStr},cid:{$ne:cid}})
    .sort(
      {
        indexedAt:-1,
        cid:-1
      })
    .limit(params.limit)
    .toArray()

  } else {
    builder =  await ctx.db.db().collection("post").find()
                        .sort(
                          {
                            indexedAt:-1,
                            cid:-1
                          })
                        .limit(params.limit)
                        .toArray()
  }

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

  public async periodicTask() {
    if (this.authorList === undefined) this.authorList = []

    const authorsCount = await this.db.db().collection(this.author_collection).countDocuments()
    if (authorsCount === this.authorList.length) return;

    const authors = await this.db.db().collection(this.author_collection).find().toArray()
    
    while(authors.length !== 0) {
      const did = authors.pop()
      if(!this.authorList.includes(`${did?.did}`)) {
        this.authorList.push(`${did?.did}`)
      }
    }
  }

  public async updateFeed() {
    dotenv.config()
    
    if (this.agent === null) {
      this.agent = new BskyAgent({ service: 'https://bsky.social' })

      const handle = `${process.env.FEEDGEN_HANDLE}`
      const password = `${process.env.FEEDGEN_PASSWORD}`

      await this.agent.login({ identifier: handle, password: password })
    }

    const lists:string[] = `${process.env.FEEDGEN_LISTS}`.split("|")
    const all_members:string[] = []

    for(let i=0;i<lists.length;i++){

      if (this.agent !== null) {

        const list_members = await getListMembers(lists[i],this.agent)
        list_members.forEach((member)=>{
          all_members.push(member)
        })

      }
    }

  }

  public filter(post: any): boolean {
    if (post.record.text.toLowerCase().includes(`${process.env.FEEDGEN_SYMBOL}`)){
      if (this.authorList.includes(post.author)) {
        console.log(`${post.author} posted ${post.uri}`)
        return true
      }
    }
    return false
  }

}