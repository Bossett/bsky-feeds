import { BskyAgent } from '@atproto/api'
import limit from './rateLimit'

export const resolveDIDToHandle = async (
  author: string,
  agent: BskyAgent,
): Promise<string> => {
  try {
    return (
      await limit(() => agent.app.bsky.actor.getProfile({ actor: author }))
    ).data.handle
  } catch {
    return author
  }
}

export default resolveDIDToHandle
