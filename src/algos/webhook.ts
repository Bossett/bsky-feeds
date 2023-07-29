import { QueryParams } from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import { AppContext } from '../config'
import { AlgoManager } from '../addn/algoManager'
import { getPostAsWebhookPayload } from '../addn/getPostAsWebhookPayload'
import dotenv from 'dotenv'
import { Post } from '../db/schema'
import dbClient from '../db/dbClient'
import fetch from 'node-fetch-native'
import resolveDIDToHandle from '../addn/resolveDIDToHandle'

dotenv.config()

// max 15 chars
export const shortname = 'webhook'

export const handler = async (ctx: AppContext, params: QueryParams) => {
  return {
    cursor: {},
    feed: [{}],
  }
}

export class manager extends AlgoManager {
  public name: string = shortname

  public async filter_post(post: Post): Promise<Boolean> {
    if (!process.env.DISCORD_WEBHOOK) return false
    if (!process.env.DISCORD_MATCH) return false

    const hook_uri = process.env.DISCORD_WEBHOOK
    const match_str = process.env.DISCORD_MATCH

    if (post.text.match(match_str) !== null) {
      let lookup_uri = post.uri

      if (post.embed?.record?.uri) lookup_uri = post.embed.record.uri
      else {
        if (post.replyParent) lookup_uri = post.replyParent
        else return false
      }

      const additional_fields = [
        {
          title: 'Additional',
          color: 9709283,
          fields: [
            {
              name: 'Parent Author',
              value: await resolveDIDToHandle(post.author, this.agent),
            },
            {
              name: 'Parent Content',
              value: `${post.text}`,
            },
            {
              name: 'Parent Link',
              value: `https://bsky.app/profile/${post.uri.split('/')[2]}/post/${
                post.uri.split('/')[4]
              }`,
            },
            {
              name: 'Parent Author Link',
              value: `https://bsky.app/profile/${post.uri.split('/')[2]}`,
            },
          ],
        },
      ]

      const params = await getPostAsWebhookPayload(
        lookup_uri,
        this.agent,
        additional_fields,
      )

      if (params) {
        const res = await fetch(hook_uri, {
          method: 'POST',
          headers: {
            'Content-type': 'application/json',
          },
          body: JSON.stringify(params),
        })
      }
    }
    return false
  }
}
