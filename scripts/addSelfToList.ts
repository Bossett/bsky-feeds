import dotenv from 'dotenv'
import { BskyAgent } from '@atproto/api'
import resolveHandleToDID from '../src/addn/resolveHandleToDID'

const run = async () => {
  dotenv.config()

  const handle = `${process.env.FEEDGEN_HANDLE}`

  const password = `${process.env.FEEDGEN_PASSWORD}`

  const agent = new BskyAgent({ service: 'https://bsky.social' })
  await agent.login({ identifier: handle, password: password })

  const listUri = `${process.argv[2]}`
  const repo = `${await resolveHandleToDID(handle, agent)}`

  await agent.com.atproto.repo.createRecord({
    collection: 'app.bsky.graph.listitem',
    repo: repo,
    record: {
      subject: repo,
      list: listUri,
      createdAt: new Date().toISOString(),
    },
  })
}

run()
