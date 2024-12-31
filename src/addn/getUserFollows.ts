import { BskyAgent } from '@atproto/api'
import resolveHandleToDID from './resolveHandleToDID'
import limit from './rateLimit'

const followCache = new Map<string, { date: number; follows: string[] }>()

export const getUserFollows = async (user: string, agent: BskyAgent) => {
  if (followCache.has(user)) {
    if (followCache.get(user)!.date > Date.now() - 1000 * 60 * 10) {
      return followCache.get(user)!.follows
    } else followCache.delete(user)
  }

  let user_did = ''
  const follows: string[] = []

  if (user.slice(0, 4) === 'did:') {
    user_did = user
  } else {
    user_did = await resolveHandleToDID(user, agent)
  }

  let cursor: string | undefined = undefined
  do {
    const res: any = await limit(() =>
      agent.api.app.bsky.graph.getFollows({
        actor: user_did,
        cursor: cursor,
      }),
    )

    cursor = res.data.cursor

    res.data.follows.forEach((follow) => {
      follows.push(`${follow.did}`)
    })
  } while (cursor !== undefined && cursor !== '')

  followCache.set(user, { date: Date.now(), follows })
  return followCache.get(user)!.follows
}

export default getUserFollows
