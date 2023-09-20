import { BskyAgent } from '@atproto/api'
import resolveHandleToDID from './resolveHandleToDID'
import moize from 'moize'
import { pRateLimit } from 'p-ratelimit'

const limit = pRateLimit({
  interval: 300 * 1000,
  rate: 2000, // limit is ~3000
  concurrency: 10,
  maxDelay: 2000,
})

export const _getUserDetails = async (user: string, agent: BskyAgent) => {
  let user_did = ''

  if (user.slice(0, 4) === 'did:') {
    user_did = user
  } else {
    user_did = await resolveHandleToDID(user, agent)
  }

  try {
    const res: any = await limit(() =>
      agent.api.app.bsky.actor.getProfile({
        actor: user_did,
      }),
    )

    const user_details = res.data

    return user_details
  } catch (error) {
    console.log(
      `core: error retrieving details ${`${error.message}`.replace('\n', ' ')}`,
    )
    return { details: '', displayName: '' }
  }
}

export const getUserDetails = moize(_getUserDetails, {
  isPromise: true,
  maxAge: 1000 * 60 * 60, // an hour
  updateExpire: true,
  equals: (newArgs: any[], lastArgs: any[]) =>
    JSON.stringify(newArgs[0]) === JSON.stringify(lastArgs[0]),
})

export default getUserDetails
