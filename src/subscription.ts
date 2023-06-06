import {
  OutputSchema as RepoEvent,
  isCommit,
} from './lexicon/types/com/atproto/sync/subscribeRepos'
import { FirehoseSubscriptionBase, getOpsByType } from './util/subscription'
import dotenv from 'dotenv'

export class FirehoseSubscription extends FirehoseSubscriptionBase {
  async handleEvent(evt: RepoEvent) {
    dotenv.config()
    if (!isCommit(evt)) return
    const ops = await getOpsByType(evt)

    const authors = await this.db
                              .selectFrom('list_members')
                              .selectAll()
                              .execute()
    const author_list:string[] = []
    
    while(authors.length !== 0) {
      const did = authors.pop()
      author_list.push(`${did?.did}`)
    }

    const postsToDelete = ops.posts.deletes.map((del) => del.uri)
    const postsToCreate = ops.posts.creates
      .filter((create) => {
        if (create.record.text.toLowerCase().includes(`${process.env.FEEDGEN_SYMBOL}`)){
          if (author_list.includes(create.author)) {
            console.log(`${create.author} posted: ${create.record.text}`)
            return true
          }
        }
        return false
      })
      .map((create) => {
        // map science-related posts to a db row
        return {
          uri: create.uri,
          cid: create.cid,
          replyParent: create.record?.reply?.parent.uri ?? null,
          replyRoot: create.record?.reply?.root.uri ?? null,
          indexedAt: new Date().toISOString(),
        }
      })

    if (postsToDelete.length > 0) {
      await this.db
        .deleteFrom('post')
        .where('uri', 'in', postsToDelete)
        .execute()
    }
    if (postsToCreate.length > 0) {
      await this.db
        .insertInto('post')
        .values(postsToCreate)
        .onConflict((oc) => oc.doNothing())
        .execute()
    }
  }
}
