import { BskyAgent } from '@atproto/api'
import limit from './rateLimit'

export const getPostAsWebhookPayload = async (
  post_uri: string,
  agent: BskyAgent,
  additional_fields: any[] = [],
) => {
  const post_detail = await limit(() =>
    agent.app.bsky.feed.getPosts({
      uris: [post_uri],
    }),
  )

  if (!post_detail.data.posts[0]) return

  const post = post_detail.data.posts[0]
  const record = <any>post.record
  const imageFields: any[] = []

  if (post.embed?.images) {
    const imagesArr: any[] = <any>post.embed.images
    imagesArr.forEach((image) => {
      imageFields.push({
        title: image.alt,
        color: 14914598,
        image: { url: image.fullsize },
      })
    })
  }

  const payload = {
    username: `${post.author.displayName}`,
    avatar_url: `${post.author.avatar}`,
    content: '',
    embeds: [
      {
        title: 'Fields',
        color: 14886454,
        thumbnail: {
          url: `${post.author.avatar}`,
        },
        fields: [
          {
            name: 'Author',
            value: `${post.author.displayName}`,
          },
          {
            name: 'Post Content',
            value: `${record.text}`,
          },
          {
            name: 'Author DID',
            value: `${post.author.did}`,
          },
          {
            name: 'Post URI',
            value: `${post_uri}`,
          },
          {
            name: 'Author Link',
            value: `https://bsky.app/profile/${post_uri.split('/')[2]}`,
          },
          {
            name: 'Post Link',
            value: `https://bsky.app/profile/${post_uri.split('/')[2]}/post/${
              post_uri.split('/')[4]
            }`,
          },
        ],
      },
      ...imageFields,
      ...additional_fields,
    ],
  }

  return payload
}

export default getPostAsWebhookPayload
