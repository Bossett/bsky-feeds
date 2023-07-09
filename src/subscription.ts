import {
  OutputSchema as RepoEvent,
  isCommit,
} from './lexicon/types/com/atproto/sync/subscribeRepos'
import { FirehoseSubscriptionBase, getOpsByType } from './util/subscription'
import dotenv from 'dotenv'

import algos from './algos'

import { Database } from './db'

import crypto from 'crypto'
import { Post } from './db/schema'

export class FirehoseSubscription extends FirehoseSubscriptionBase {
  public algoManagers: any[]

  constructor(db: Database, subscriptionEndpoint: string) {
    super(db, subscriptionEndpoint)

    this.algoManagers = []

    Object.keys(algos).forEach((algo) => {
      this.algoManagers.push(new algos[algo].manager(db))
    })

    this.algoManagers.forEach(async (algo) => {
      await algo._start()
    })
  }

  public authorList: string[]
  public intervalId: NodeJS.Timer

  async handleEvent(evt: RepoEvent) {
    for (let i = 0; i < this.algoManagers.length; i++) {
      await this.algoManagers[i].ready()
    }

    dotenv.config()
    if (!isCommit(evt)) return
    const ops = await getOpsByType(evt)

    const postsToDelete = ops.posts.deletes.map((del) => del.uri)

    const postsCreated: Post[] = ops.posts.creates.flatMap((create) => {
      const post: Post = {
        _id: null,
        uri: create.uri,
        cid: create.cid,
        author: create.author,
        text: create.record?.text,
        replyParent: create.record?.reply?.parent.uri ?? null,
        replyRoot: create.record?.reply?.root.uri ?? null,
        indexedAt: new Date().getTime(),
        algoTags: null,
      }

      return [post]
    })

    const postsToCreate: Post[] = []

    for (let post_i = 0; post_i < postsCreated.length; post_i++) {
      const post = postsCreated[post_i]
      const algoTags: string[] = []
      let include = false

      for (let i = 0; i < this.algoManagers.length; i++) {
        const includeAlgo = await this.algoManagers[i].filter_post(post)
        include = include || includeAlgo
        if (includeAlgo) algoTags.push(`${this.algoManagers[i].name}`)
      }

      if (!include) return

      const hash = crypto
        .createHash('shake256', { outputLength: 12 })
        .update(post.uri)
        .digest('hex')
        .toString()

      post._id = hash
      post.algoTags = [...algoTags]

      postsToCreate.push(post)
    }

    if (postsToDelete.length > 0) {
      await this.db.deleteManyURI('post', postsToDelete)
    }

    if (postsToCreate.length > 0) {
      postsToCreate.forEach(async (to_insert) => {
        await this.db.replaceOneURI('post', to_insert.uri, to_insert)
      })
    }
  }
}
