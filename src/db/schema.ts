import {ObjectId} from 'mongodb'

export type DatabaseSchema = {
  post: Post
  sub_state: SubState
  list_members: ListMember
}

export type Post = {
  _id: ObjectId
  uri: string
  cid: string
  replyParent: string | null
  replyRoot: string | null
  indexedAt: number
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