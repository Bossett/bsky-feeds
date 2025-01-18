import { cborToLexRecord, readCar } from '@atproto/repo'
import { BlobRef } from '@atproto/lexicon'
import { ids, lexicons } from '../lexicon/lexicons'
import { Record as PostRecord } from '../lexicon/types/app/bsky/feed/post'
import { Record as RepostRecord } from '../lexicon/types/app/bsky/feed/repost'
import { Record as LikeRecord } from '../lexicon/types/app/bsky/feed/like'
import { Record as FollowRecord } from '../lexicon/types/app/bsky/graph/follow'
import { Commit } from '../lexicon/types/com/atproto/sync/subscribeRepos'
import { Database } from '../db'

import { Jetstream, CommitType } from '@skyware/jetstream'
import WebSocket from 'ws'

import { Semaphore } from 'async-mutex'

const semaphore = new Semaphore(128)

const includedRecords = new Set(['app.bsky.feed.post'])

export abstract class FirehoseSubscriptionBase {
  public jetstream: Jetstream

  constructor(public db: Database, public service: string) {}

  abstract handleEvent(evt: any): Promise<void>

  async run(subscriptionReconnectDelay: number) {
    let lastSuccessfulCursor = (await this.getCursor()).cursor
    const eventQueue: any[] = []

    this.jetstream = new Jetstream({
      wantedCollections: Array.from(includedRecords.values()),
      ws: WebSocket,
      cursor: lastSuccessfulCursor,
      endpoint: 'wss://jetstream2.us-west.bsky.network/subscribe',
    })

    this.jetstream.on('commit', (event) => {
      eventQueue.push(event)
      if (
        eventQueue.length > 100000 &&
        this.jetstream.ws?.readyState === WebSocket.OPEN
      ) {
        console.log('core: queue too large, closing jetstream...')
        this.jetstream.close()
      }
    })

    const processEvent = async (event: any) => {
      const posts = {
        cursor: event.time_us,
        creates: [] as {
          uri: string
          cid: string
          author: string
          record: any
        }[],
        deletes: [] as { uri: string }[],
      }

      if (event.commit.operation === CommitType.Create) {
        posts.creates.push({
          uri: `at://${event.did}/${event.commit.collection}/${event.commit.rkey}`,
          cid: event.commit.cid,
          author: event.did,
          record: event.commit.record,
        })
      }
      if (event.commit.operation === CommitType.Delete) {
        posts.deletes.push({
          uri: `at://${event.did}/${event.commit.collection}/${event.commit.rkey}`,
        })
      }

      return posts
    }

    const processQueue = async () => {
      let handledEvents = 0
      let lastSuccessfulCursor = (await this.getCursor()).cursor

      while (true) {
        if (eventQueue.length === 0) {
          if (
            this.jetstream.ws?.readyState !== WebSocket.OPEN &&
            this.jetstream.ws?.readyState !== WebSocket.CONNECTING
          ) {
            console.log('core: jetstream closed, starting...')
            this.jetstream.cursor = lastSuccessfulCursor
            this.jetstream.start()
          } else {
            await new Promise((resolve) => setTimeout(resolve, 1))
          }
        }

        while (eventQueue.length > 0) {
          const event = eventQueue.shift()
          if (!event) continue

          const posts = await processEvent(event)
          if (handledEvents >= 1000) {
            if (lastSuccessfulCursor) this.updateCursor(lastSuccessfulCursor)
            handledEvents = 0
          }

          await semaphore.acquire().then(async ([value, release]) => {
            this.handleEvent(posts)
              .then(() => {
                lastSuccessfulCursor = posts.cursor
                handledEvents++
              })
              .finally(() => {
                release()
              })
          })
        }
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 10 * 1000))
    await processQueue()
  }

  async updateCursor(cursor: number) {
    await this.db.updateSubStateCursor(this.service, cursor)
  }

  async getCursor(): Promise<{ cursor?: number }> {
    const res = await this.db.getSubStateCursor(this.service)
    return res ? { cursor: res.cursor } : {}
  }
}

export const getOpsByType = async (evt: Commit): Promise<OperationsByType> => {
  const car = await readCar(evt.blocks)
  const opsByType: OperationsByType = {
    posts: { creates: [], deletes: [] },
    reposts: { creates: [], deletes: [] },
    likes: { creates: [], deletes: [] },
    follows: { creates: [], deletes: [] },
  }

  for (const op of evt.ops) {
    const uri = `at://${evt.repo}/${op.path}`
    const [collection] = op.path.split('/')

    if (!includedRecords.has(collection)) continue

    if (op.action === 'update') continue // updates not supported yet

    if (op.action === 'create') {
      if (!op.cid) continue
      const recordBytes = car.blocks.get(op.cid)
      if (!recordBytes) continue
      const record = cborToLexRecord(recordBytes)
      const create = { uri, cid: op.cid.toString(), author: evt.repo }
      if (collection === ids.AppBskyFeedPost && isPost(record)) {
        opsByType.posts.creates.push({ record, ...create })
      } else if (collection === ids.AppBskyFeedRepost && isRepost(record)) {
        opsByType.reposts.creates.push({ record, ...create })
      } else if (collection === ids.AppBskyFeedLike && isLike(record)) {
        opsByType.likes.creates.push({ record, ...create })
      } else if (collection === ids.AppBskyGraphFollow && isFollow(record)) {
        opsByType.follows.creates.push({ record, ...create })
      }
    }

    if (op.action === 'delete') {
      if (collection === ids.AppBskyFeedPost) {
        opsByType.posts.deletes.push({ uri })
      } else if (collection === ids.AppBskyFeedRepost) {
        opsByType.reposts.deletes.push({ uri })
      } else if (collection === ids.AppBskyFeedLike) {
        opsByType.likes.deletes.push({ uri })
      } else if (collection === ids.AppBskyGraphFollow) {
        opsByType.follows.deletes.push({ uri })
      }
    }
  }

  return opsByType
}

type OperationsByType = {
  posts: Operations<PostRecord>
  reposts: Operations<RepostRecord>
  likes: Operations<LikeRecord>
  follows: Operations<FollowRecord>
}

type Operations<T = Record<string, unknown>> = {
  creates: CreateOp<T>[]
  deletes: DeleteOp[]
}

type CreateOp<T> = {
  uri: string
  cid: string
  author: string
  record: T
}

type DeleteOp = {
  uri: string
}

export const isPost = (obj: unknown): obj is PostRecord => {
  return isType(obj, ids.AppBskyFeedPost)
}

export const isRepost = (obj: unknown): obj is RepostRecord => {
  return isType(obj, ids.AppBskyFeedRepost)
}

export const isLike = (obj: unknown): obj is LikeRecord => {
  return isType(obj, ids.AppBskyFeedLike)
}

export const isFollow = (obj: unknown): obj is FollowRecord => {
  return isType(obj, ids.AppBskyGraphFollow)
}

const isType = (obj: unknown, nsid: string) => {
  try {
    lexicons.assertValidRecord(nsid, fixBlobRefs(obj))
    return true
  } catch (err) {
    return false
  }
}

// @TODO right now record validation fails on BlobRefs
// simply because multiple packages have their own copy
// of the BlobRef class, causing instanceof checks to fail.
// This is a temporary solution.
const fixBlobRefs = (obj: unknown): unknown => {
  if (Array.isArray(obj)) {
    return obj.map(fixBlobRefs)
  }
  if (obj && typeof obj === 'object') {
    if (obj.constructor.name === 'BlobRef') {
      const blob = obj as BlobRef
      return new BlobRef(blob.ref, blob.mimeType, blob.size, blob.original)
    }
    return Object.entries(obj).reduce((acc, [key, val]) => {
      return Object.assign(acc, { [key]: fixBlobRefs(val) })
    }, {} as Record<string, unknown>)
  }
  return obj
}
