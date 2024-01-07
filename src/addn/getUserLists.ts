import { BskyAgent } from '@atproto/api'

export const getUserLists = async (
  did: string,
  agent: BskyAgent,
): Promise<{ name: string; atURL: string }[]> => {
  let current_cursor: string | undefined = undefined

  let total_retrieved = 0
  const user_lists: { name: string; atURL: string }[] = []

  do {
    const lists: any = await agent.api.app.bsky.graph.getLists({
      actor: `${did}`,
      limit: 100,
      cursor: current_cursor,
    })

    lists.data.lists.forEach((list: any) => {
      user_lists.push({ name: list.name, atURL: list.uri })
    })

    current_cursor = lists.data.cursor
  } while (total_retrieved >= 100)

  return user_lists
}

export default getUserLists
