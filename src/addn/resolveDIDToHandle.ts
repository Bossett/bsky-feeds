import { BskyAgent } from '@atproto/api'

export const resolveDIDToHandle = async (
  author: string,
  agent: BskyAgent,
): Promise<string> => {
  try {
    return (await agent.app.bsky.actor.getProfile({ actor: author })).data
      .handle
  } catch {
    return 'unknown'
  }
}

export default resolveDIDToHandle
