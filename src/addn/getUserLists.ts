import { BskyAgent } from '@atproto/api'

export const getUserLists = async (
  did: string,
  agent: BskyAgent,
): Promise<{ name: string; atURL: string }[]> => {
  let current_cursor: string | undefined = undefined

  let total_retrieved = 0
  const user_lists: { name: string; atURL: string }[] = []

  do {
    const lists = await agent.api.com.atproto.repo.listRecords({
      repo: `${did}`,
      collection: 'app.bsky.graph.list',
      limit: 100,
      cursor: current_cursor,
    })

    lists.data.records.forEach((list: any) => {
      if (list.value) {
        user_lists.push({ name: list.value.name, atURL: list.uri })
      }
    })
  } while (total_retrieved >= 100)

  return user_lists
}

export default getUserLists
