import { BskyAgent } from '@atproto/api'
import resolveHandleToDID from './resolveHandleToDID'
import moize from 'moize'
import { pRateLimit } from 'p-ratelimit'

import { ProfileViewDetailed } from '../lexicon/types/app/bsky/actor/defs'

const limit = pRateLimit({
  interval: 300 * 1000,
  rate: 2000,
  concurrency: 10,
  maxDelay: 30 * 1000,
})

interface Resolver {
  resolve: (value: any) => void
  reject: (reason?: any) => void
  user_did: string
}

let batch: string[] = []
let timer: NodeJS.Timeout | null = null
let resolvers: Resolver[] = []

let isBatchExecutionInProgress = false

const executeBatch = async (agent: BskyAgent) => {
  const currentBatch = batch
  const currentResolvers = resolvers

  batch = []
  resolvers = []

  try {
    let res: any

    try {
      res = await limit(() =>
        agent.app.bsky.actor.getProfiles({
          actors: currentBatch,
        }),
      )
    } catch (error) {
      console.log(`core: error during getProfiles ${error.message}`)
    }

    const resultsMap = Object.fromEntries(
      res.data.profiles.map((record: ProfileViewDetailed) => [
        record.did,
        record,
      ]),
    )
    currentResolvers.forEach(({ resolve, user_did }) => {
      resolve(resultsMap[user_did] || { details: '', displayName: '' })
    })
  } catch (error) {
    currentResolvers.forEach(({ reject }) => reject(error))
  } finally {
    timer = null
    isBatchExecutionInProgress = false
  }
}

export const _getUserDetails = async (
  user: string,
  agent: BskyAgent,
): Promise<ProfileViewDetailed> => {
  let user_did = ''

  if (user.slice(0, 4) === 'did:') {
    user_did = user
  } else {
    user_did = await resolveHandleToDID(user, agent)
  }

  return new Promise((resolve, reject) => {
    batch.push(user_did)
    resolvers.push({ resolve, reject, user_did })

    if (batch.length >= 25 && !isBatchExecutionInProgress) {
      clearTimeout(timer!)
      isBatchExecutionInProgress = true
      executeBatch(agent)
    } else if (!timer) {
      timer = setTimeout(() => {
        if (!isBatchExecutionInProgress) {
          isBatchExecutionInProgress = true
          executeBatch(agent)
        }
      }, 1000)
    }
  })
}

const getUserDetails = moize(_getUserDetails, {
  isPromise: true,
  maxAge: 1000 * 60 * 60 * 3, // three hour
  updateExpire: true,
  isShallowEqual: true,
})

export default getUserDetails
