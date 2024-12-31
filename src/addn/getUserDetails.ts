import { BskyAgent } from '@atproto/api'
import resolveHandleToDID from './resolveHandleToDID'

import { ProfileViewDetailed } from '../lexicon/types/app/bsky/actor/defs'

import limit from './rateLimit'

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
    let resultsMap: { [k: string]: any } = {}

    const promises: Promise<any>[] = []
    for (let i = 0; i < currentBatch.length; i += maxRequestChunk) {
      const chunk = currentBatch.slice(i, i + maxRequestChunk)
      promises.push(
        limit(() =>
          agent.app.bsky.actor.getProfiles({
            actors: chunk,
          }),
        ),
      )
    }

    const responses = await Promise.all(promises)
    responses.forEach((res) => {
      resultsMap = {
        ...Object.fromEntries(
          res.data.profiles.map((record: ProfileViewDetailed) => [
            record.did,
            record,
          ]),
        ),
        ...resultsMap,
      }
    })

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
      }, 500)
    }
  })
}

const userDetailsMap = new Map<string, ProfileViewDetailed>()
const userExpiryMap = new Map<string, number>()
const expiryTime = 1000 * 60 * 60 * 3

const getUserDetails = async (
  user: string,
  agent: BskyAgent,
): Promise<ProfileViewDetailed> => {
  const now = Date.now()
  const expiry = userExpiryMap.get(user)

  const isValid = expiry && expiry > now

  if (isValid && userDetailsMap.has(user)) {
    return userDetailsMap.get(user)!
  }

  userExpiryMap.delete(user)
  const userDetails = await _getUserDetails(user, agent)
  userDetailsMap.set(user, userDetails)
  userExpiryMap.set(user, Date.now() + expiryTime)
  return userDetails
}

export default getUserDetails
