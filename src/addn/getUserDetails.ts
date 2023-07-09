import { BskyAgent } from '@atproto/api'
import resolveHandleToDID from './resolveHandleToDID'

export const getUserDetails = async (user: string, agent: BskyAgent) => {
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

export default getUserDetails
