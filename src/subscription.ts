import { FirehoseSubscriptionBase } from './util/subscription'

import algos from './algos'
import batchUpdate from './addn/batchUpdate'

import { Database } from './db'

import crypto from 'crypto'
import { BskyAgent } from '@atproto/api'

export class FirehoseSubscription extends FirehoseSubscriptionBase {
  public algoManagers: any[]

  constructor(db: Database, subscriptionEndpoint: string) {
    super(db, subscriptionEndpoint)

    this._constructor(db, subscriptionEndpoint)
  }

  async _constructor(db: Database, subscriptionEndpoint: string) {
    this.algoManagers = []

    const agent = new BskyAgent({ service: 'https://public.api.bsky.app' })

    batchUpdate(agent, 5 * 60 * 1000)

    Object.keys(algos).forEach((algo) => {
      this.algoManagers.push(new algos[algo].manager(db, agent))
    })

    const startAlgosConcurrently = async () => {
      const startPromises = this.algoManagers.map(async (algo) => {
        if (await algo._start()) {
          console.log(`${algo.name}: Started`)
        }
      })
      await Promise.all(startPromises)
    }

    startAlgosConcurrently()
  }

  public authorList: string[]
  public intervalId: NodeJS.Timer

  async handleEvent(posts) {
    if (posts.creates.length === 0 && posts.deletes.length === 0) return

    const postsToDelete = posts.deletes.map((del) => del.uri)

    // Transform posts in parallel
    const postsCreated = posts.creates.map((create) => ({
      _id: null,
      uri: create.uri,
      cid: create.cid,
      author: create.author,
      text: `${create.record?.text}`,
      replyParent: create.record?.reply?.parent?.uri ?? null,
      replyRoot: create.record?.reply?.root?.uri ?? null,
      indexedAt: new Date().getTime(),
      createdAt: new Date(create.record?.createdAt).getTime(),
      algoTags: null,
      embed: create.record?.embed,
      tags: Array.isArray(create.record?.tags) ? create.record?.tags : [],
    }))

    const postsToCreatePromises = postsCreated.map(async (post) => {
      try {
        const algoTags = (
          await Promise.all(
            this.algoManagers.map(async (manager) => {
              try {
                const includeAlgo = await manager.filter_post(post)
                return includeAlgo ? manager.name : null
              } catch (err) {
                console.error(`${manager.name}: filter failed`, err)
                console.error(post)
                return null
              }
            }),
          )
        ).filter((tag) => tag !== null)

        if (algoTags.length === 0) return null

        const hash = crypto
          .createHash('shake256', { outputLength: 12 })
          .update(post.uri)
          .digest('hex')
          .toString()

        return {
          ...post,
          _id: hash,
          algoTags,
          earliestCreatedIndexedAt: Math.min(post.createdAt, post.indexedAt),
        }
      } catch (err) {
        console.error('Post processing failed', err)
        return null
      }
    })

    const postsToCreate = (await Promise.all(postsToCreatePromises)).filter(
      (post) => post !== null,
    )

    const dbOperations: Promise<any>[] = []

    if (postsToDelete.length > 0) {
      dbOperations.push(this.db.deleteManyURI('post', postsToDelete))
    }

    if (postsToCreate.length > 0) {
      postsToCreate.forEach(async (to_insert) => {
        if (to_insert)
          dbOperations.push(
            this.db.replaceOneURI('post', to_insert.uri, to_insert),
          )
      })
    }

    await Promise.all(dbOperations)
  }
}
