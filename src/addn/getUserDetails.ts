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
let maxRequestChunk = 25

const executeBatch = async (agent: BskyAgent) => {
  const currentBatch = batch
  const currentResolvers = resolvers

  batch = []
  resolvers = []

  try {
    let res: any
    let resultsMap: { [k: string]: any } = {}

    for (let i = 0; i < currentBatch.length; i += maxRequestChunk) {
      const chunk = currentBatch.slice(i, i + maxRequestChunk)

      try {
        res = await limit(() =>
          agent.app.bsky.actor.getProfiles({
            actors: chunk,
          }),
        )
      } catch (error) {
        console.log(`core: error during getProfiles ${error.message}`)
        throw error
      }

      resultsMap = {
        ...Object.fromEntries(
          res.data.profiles.map((record: ProfileViewDetailed) => [
            record.did,
            record,
          ]),
        ),
        ...resultsMap,
      }
    }
    currentResolvers.forEach(({ resolve, user_did }) => {
      resolve(resultsMap[user_did])
    })
  } catch (error) {
    console.log(`core: error during getProfiles ${error.message}`)
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

    if (batch.length >= maxRequestChunk && !isBatchExecutionInProgress) {
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
  maxAge: 1000 * 60 * 60 * 3, // three hours
  updateExpire: true,
  isShallowEqual: true,
})

export default getUserDetails
