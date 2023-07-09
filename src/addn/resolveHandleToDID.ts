import { BskyAgent } from '@atproto/api'

export const resolveHandleToDID = async (
  author: string,
  agent: BskyAgent,
): Promise<string> => {
  return (
    await agent.com.atproto.identity.resolveHandle({
      handle: author,
    })
  ).data.did
}

export default resolveHandleToDID
