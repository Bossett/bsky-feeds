import { BskyAgent } from '@atproto/api'
import limit from './rateLimit'

import { Post } from '../db/schema'

export const getPostFromURI = async (
  atUri: string,
  agent: BskyAgent,
): Promise<Post | undefined> => {
  const [repo, collection, rkey] = atUri.startsWith('at://')
    ? atUri.replace('at://', '').split('/')
    : [undefined, undefined, undefined]

  if (!repo || !collection || !rkey) return undefined

  const response = await limit(() =>
    agent.com.atproto.repo.getRecord({
      repo,
      collection,
      rkey,
    }),
  )

  if (!response.success) return undefined

  const record = response.data

  if (!record.cid) return undefined

  const postValue: any = record.value

  const post: Post = {
    _id: null,
    uri: record.uri,
    cid: record.cid,
    author: repo,
    text: postValue.text,
    replyParent: postValue.reply?.parent.uri ?? null,
    replyRoot: postValue.reply?.root.uri ?? null,
    indexedAt: new Date().getTime(),
    algoTags: null,
    embed: postValue.embed,
  }

  return post
}

export default getPostFromURI
