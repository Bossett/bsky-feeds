import {
  OutputSchema as RepoEvent,
  isCommit,
} from './lexicon/types/com/atproto/sync/subscribeRepos'
import { FirehoseSubscriptionBase, getOpsByType } from './util/subscription'
import dotenv from 'dotenv'

import algos from './algos'

import {MongoClient, ObjectId} from 'mongodb'

import crypto from 'crypto'

export class FirehoseSubscription extends FirehoseSubscriptionBase {

  public algoManagers:any[]

  constructor(db: MongoClient, subscriptionEndpoint: string) {
    super(db, subscriptionEndpoint)

    this.algoManagers = []

    Object.keys(algos).forEach((algo)=>{
      this.algoManagers.push(new algos[algo].manager(db))
    })
  }

  public authorList:string[]
  public intervalId:NodeJS.Timer
 
  async handleEvent(evt: RepoEvent) {

    for (let i = 0; i < this.algoManagers.length; i++) {
      await this.algoManagers[i].ready()
    }

    dotenv.config()
    if (!isCommit(evt)) return
    const ops = await getOpsByType(evt)

    const postsToDelete = ops.posts.deletes.map((del) => del.uri)
    const postsToCreate = ops.posts.creates
      .flatMap((create) => {

        let include = false

        const algoTags: string[] = [] 

        for (let i = 0; i < this.algoManagers.length; i++) {
          const includeAlgo = this.algoManagers[i].filter(create)
          include = include || includeAlgo
          if (includeAlgo) algoTags.push(`${this.algoManagers[i].name}`)
        }

        if (!include) return []

        const hash = crypto.createHash('shake256',{outputLength:12}).update(create.uri).digest('hex').toString()

        return [{
          _id: new ObjectId(hash),
          uri: create.uri,
          cid: create.cid,
          replyParent: create.record?.reply?.parent.uri ?? null,
          replyRoot: create.record?.reply?.root.uri ?? null,
          indexedAt: new Date().getTime(),
          algoTags: algoTags
        }]
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