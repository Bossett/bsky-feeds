import {
  OutputSchema as RepoEvent,
  isCommit,
} from './lexicon/types/com/atproto/sync/subscribeRepos'
import { FirehoseSubscriptionBase, getOpsByType } from './util/subscription'
import dotenv from 'dotenv'

import {ObjectId} from 'mongodb'

import crypto from 'crypto'

export class FirehoseSubscription extends FirehoseSubscriptionBase {

  public authorList:string[]
  public intervalId:NodeJS.Timer

  async updateAuthors() {
    
    if (this.authorList === undefined) this.authorList = []

    const authorsCount = await this.db.db().collection("list_members").countDocuments()
    if (authorsCount === this.authorList.length) return;

    const authors = await this.db.db().collection("list_members").find().toArray()
    
    while(authors.length !== 0) {
      const did = authors.pop()
      if(!this.authorList.includes(`${did?.did}`)) {
        this.authorList.push(`${did?.did}`)
      }
    }
  }

  async handleEvent(evt: RepoEvent) {
    dotenv.config()
    if (!isCommit(evt)) return
    const ops = await getOpsByType(evt)

    await this.updateAuthors()

    if (!this.intervalId) {
      this.intervalId = setInterval(()=>{this.updateAuthors()},15000)
    }

    const postsToDelete = ops.posts.deletes.map((del) => del.uri)
    const postsToCreate = ops.posts.creates
      .filter((create) => {
        if (create.record.text.toLowerCase().includes(`${process.env.FEEDGEN_SYMBOL}`)){
          if (this.authorList.includes(create.author)) {
            console.log(`${create.author} posted ${create.uri}`)
            return true
          }
        }
        return false
      })
      .map((create) => {
        // map science-related posts to a db row
        const hash = crypto.createHash('shake256',{outputLength:12}).update(create.uri).digest('hex').toString()

        return {
          _id: new ObjectId(hash),
          uri: create.uri,
          cid: create.cid,
          replyParent: create.record?.reply?.parent.uri ?? null,
          replyRoot: create.record?.reply?.root.uri ?? null,
          indexedAt: new Date().getTime(),
        }
      })

    if (postsToDelete.length > 0) {
      await this.db.db().collection("post").deleteMany({uri:{$in:postsToDelete}})
    }
    if (postsToCreate.length > 0) {

      postsToCreate.forEach(async (to_insert) => {
        await this.db.db().collection("post").replaceOne({"uri":to_insert.uri},to_insert,{upsert:true})
      })
    }
  }
}
