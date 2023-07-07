import { ObjectId } from 'mongodb'

export type DatabaseSchema = {
  post: Post
  sub_state: SubState
  list_members: ListMember
}

export type Post = {
  _id: ObjectId | null
  uri: string
  cid: string
  author: string
  text: string
  replyParent: string | null
  replyRoot: string | null
  indexedAt: number
  algoTags: string[] | null
}

export type SubState = {
  _id: ObjectId
  service: string
  cursor: number
}

export type ListMember = {
  _id: ObjectId
  did: string
}
