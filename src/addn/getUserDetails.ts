import { BskyAgent } from '@atproto/api'
import resolveHandleToDID from './resolveHandleToDID'
import moize from 'moize'

export const _getUserDetails = async (user: string, agent: BskyAgent) => {
  let user_did = ''

  if (user.slice(0, 4) === 'did:') {
    user_did = user
  } else {
    user_did = await resolveHandleToDID(user, agent)
  }

  const res: any = await agent.api.app.bsky.actor.getProfile({
    actor: user_did,
  })

  const user_details = res.data

  return user_details
}

export const getUserDetails = moize(_getUserDetails, {
  isPromise: true,
  maxAge: 1000 * 60 * 60, // an hour
})

export default getUserDetails
