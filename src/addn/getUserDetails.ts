import { BskyAgent } from '@atproto/api'
import resolveHandleToDID from './resolveHandleToDID'
import moize, { Cache } from 'moize'
import { pRateLimit } from 'p-ratelimit'

const limit = pRateLimit({
  interval: 300 * 1000,
  rate: 2000, // limit is ~3000
  concurrency: 10,
  maxDelay: 30 * 1000,
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
      agent.com.atproto.repo.listRecords({
        repo: user_did,
        collection: 'app.bsky.actor.profile',
      }),
    )

    const user_details = res.data

    console.log(user_details.records[0].value)

    return user_details.records[0].value
  } catch (error) {
    return { details: '', displayName: '' }
  }
}

const getUserDetails = moize(_getUserDetails, {
  isPromise: true,
  maxAge: 1000 * 60 * 60, // an hour
  updateExpire: true,
  isShallowEqual: true,
})

export default getUserDetails
