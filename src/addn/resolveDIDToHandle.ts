import { BskyAgent } from '@atproto/api'

export const resolveDIDToHandle = async (
  author: string,
  agent: BskyAgent,
): Promise<string> => {
  return (await agent.app.bsky.actor.getProfile({ actor: author })).data.handle
}

export default resolveDIDToHandle
