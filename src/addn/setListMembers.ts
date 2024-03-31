import { BskyAgent } from '@atproto/api'
import limit from './rateLimit'

export const setListMembers = async (
  list: string,
  dids: string[],
  agent: BskyAgent,
): Promise<{ users_added: string[]; users_removed: string[] }> => {
  let total_retrieved = 1
  let current_cursor: string | undefined = undefined
  const members: any[] = []
  const online_list_members: string[] = []

  const list_did = `${list.split('/').at(2)}`

  do {
    const list_members = await limit(() =>
      agent.com.atproto.repo.listRecords({
        repo: list_did,
        collection: 'app.bsky.graph.listitem',
        limit: 100,
        cursor: current_cursor,
      }),
    )
    total_retrieved = list_members.data.records.length
    current_cursor = list_members.data.cursor

    list_members.data.records.forEach((member) => {
      if ((<any>member.value).list === list) {
        online_list_members.push((<any>member.value).subject.did)
        members.push(member)
      }
    })
  } while (current_cursor !== undefined && current_cursor !== '')

  const users_to_add = dids.filter((member) => {
    return !online_list_members.includes(member)
  })

  const users_to_remove = online_list_members.filter((member) => {
    return !dids.includes(member)
  })

  const writes: any[] = []
  users_to_add.forEach((user) => {
    writes.push({
      $type: 'com.atproto.repo.applyWrites#create',
      collection: 'app.bsky.graph.listitem',
      value: {
        list: list,
        $type: 'app.bsky.graph.listitem',
        subject: user,
        createdAt: new Date().toISOString(),
      },
    })
  })
  members.forEach((member) => {
    if (users_to_remove.includes((<any>member.value).subject.did)) {
      const rkey = `${member.uri}`.substring(
        `${member.uri}`.lastIndexOf('/') + 1,
      )
      writes.push({
        $type: 'com.atproto.repo.applyWrites#delete',
        collection: 'app.bsky.graph.listitem',
        rkey: rkey,
      })
    }
  })

  const chunkSize = 10

  for (let i = 0; i < writes.length; i += chunkSize) {
    const chunk = writes.slice(i, i + chunkSize)
    const res = await limit(() =>
      agent.com.atproto.repo.applyWrites({
        repo: list_did,
        writes: chunk,
      }),
    )
  }

  return { users_added: [...users_to_add], users_removed: [...users_to_remove] }
}

export default setListMembers
