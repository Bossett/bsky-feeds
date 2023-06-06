import {
  OutputSchema as RepoEvent,
  isCommit,
} from './lexicon/types/com/atproto/sync/subscribeRepos'
import { FirehoseSubscriptionBase, getOpsByType } from './util/subscription'
import dotenv from 'dotenv'

export class FirehoseSubscription extends FirehoseSubscriptionBase {

  public authorList:string[]

  async updateAuthors() {
    
    if (this.authorList === undefined) this.authorList = []
    
    const authors = await this.db
                              .selectFrom('list_members')
                              .selectAll()
                              .execute()
    
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

    setInterval(()=>{this.updateAuthors()},15000)

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
