export type DatabaseSchema = {
  post: Post
  sub_state: SubState
  list_members: ListMember
}

export type Post = {
  uri: string
  cid: string
  replyParent: string | null
  replyRoot: string | null
  indexedAt: string
}

export type SubState = {
  service: string
  cursor: number
}

export type ListMember = {
  did: string
}