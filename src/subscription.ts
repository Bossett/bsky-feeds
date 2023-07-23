import {
  OutputSchema as RepoEvent,
  isCommit,
} from './lexicon/types/com/atproto/sync/subscribeRepos'
import { FirehoseSubscriptionBase, getOpsByType } from './util/subscription'
import dotenv from 'dotenv'

import algos from './algos'
import batchUpdate from './addn/batchUpdate'

import { Database } from './db'

import crypto from 'crypto'
import { Post } from './db/schema'
import { BskyAgent } from '@atproto/api'

export class FirehoseSubscription extends FirehoseSubscriptionBase {
  public algoManagers: any[]

  constructor(db: Database, subscriptionEndpoint: string) {
    super(db, subscriptionEndpoint)

    this.algoManagers = []

    const agent = new BskyAgent({ service: 'https://bsky.social' })

    dotenv.config()
    const handle = `${process.env.FEEDGEN_HANDLE}`
    const password = `${process.env.FEEDGEN_PASSWORD}`

    agent.login({ identifier: handle, password: password }).then(() => {
      batchUpdate(agent, 5 * 60 * 1000)

      Object.keys(algos).forEach((algo) => {
        this.algoManagers.push(new algos[algo].manager(db, agent))
      })

      this.algoManagers.forEach(async (algo) => {
        if (await algo._start()) console.log(`${algo.name}: Started`)
      })
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
        embed: create.record?.embed,
      }

      return [post]
    })

    const postsToCreate: Post[] = []

    for (let post_i = 0; post_i < postsCreated.length; post_i++) {
      const post = postsCreated[post_i]
      const algoTags: string[] = []
      let include = false

      for (let i = 0; i < this.algoManagers.length; i++) {
        let includeAlgo = false
        try {
          includeAlgo = await this.algoManagers[i].filter_post(post)
        } catch (err) {
          console.error(`${this.algoManagers[i].name}: filter failed`, err)
          includeAlgo = false
        }
        if (includeAlgo) algoTags.push(`${this.algoManagers[i].name}`)
        include = include || includeAlgo
      }

      if (!include) continue

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
