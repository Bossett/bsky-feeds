import { BskyAgent } from '@atproto/api'

export const setListMembers = async (
  list: string,
  dids: string[],
  agent: BskyAgent,
) => {
  let total_retrieved = 1
  let current_cursor: string | undefined = undefined
  const members: any[] = []
  const online_list_members: string[] = []

  const list_did = `${list.split('/').at(2)}`

  while (total_retrieved > 0) {
    const list_members = await agent.com.atproto.repo.listRecords({
      repo: list_did,
      collection: 'app.bsky.graph.listitem',
      limit: 100,
      cursor: current_cursor,
    })
    total_retrieved = list_members.data.records.length
    current_cursor = list_members.data.cursor

    list_members.data.records.forEach((member) => {
      if ((<any>member.value).list === list) {
        online_list_members.push((<any>member.value).subject.did)
        members.push(member)
      }
    })
  }

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

  const chunkSize = 50

  for (let i = 0; i < writes.length; i += chunkSize) {
    const chunk = writes.slice(i, i + chunkSize)
    const res = await agent.com.atproto.repo.applyWrites({
      repo: list_did,
      writes: chunk,
    })
  }
}

export default setListMembers
