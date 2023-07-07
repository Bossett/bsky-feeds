import { DidResolver } from '@atproto/did-resolver'
import dbClient from './db/dbClient'

export type AppContext = {
  db: typeof dbClient
  didResolver: DidResolver
  cfg: Config
}

export type Config = {
  port: number
  listenhost: string
  hostname: string
  mongoDbConnectionString: string
  subscriptionEndpoint: string
  serviceDid: string
  publisherDid: string
}
