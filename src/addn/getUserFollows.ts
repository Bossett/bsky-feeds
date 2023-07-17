import { BskyAgent } from '@atproto/api'
import resolveHandleToDID from './resolveHandleToDID'
import moize from 'moize'

export const _getUserFollows = async (user: string, agent: BskyAgent) => {
  let user_did = ''
  const follows: string[] = []

  if (user.slice(0, 4) === 'did:') {
    user_did = user
  } else {
    user_did = await resolveHandleToDID(user, agent)
  }

  let cursor: string | undefined = undefined
  while (true) {
    const res: any = await agent.api.app.bsky.graph.getFollows({
      actor: user_did,
      cursor: cursor,
    })

    if (res.data.follows.length === 0) break

    cursor = res.data.cursor

    res.data.follows.forEach((follow) => {
      follows.push(`${follow.did}`)
    })
  }

  return follows
}

export const getUserFollows = moize(_getUserFollows, {
  isPromise: true,
  maxAge: 1000 * 60 * 10, // 10 minutes
})

export default getUserFollows
