export type DatabaseSchema = {
  post: Post
  sub_state: SubState
  list_members: ListMember
}

export type Post = {
  _id: string | null
  uri: string
  cid: string
  author: string
  text: string
  replyParent: string | null
  replyRoot: string | null
  indexedAt: number
  algoTags: string[] | null
  embed?: any | null
  tags?: string[] | null
}

export type SubState = {
  _id: string | null
  service: string
  cursor: number
}

export type ListMember = {
  _id: string | null
  did: string
}
