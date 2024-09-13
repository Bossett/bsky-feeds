import dbClient from '../db/dbClient'
import limit from './rateLimit'

export default async function batchUpdate(agent, interval) {
  let firstRun = true
  while (true) {
    if (!firstRun) await new Promise((resolve) => setTimeout(resolve, interval))
    else firstRun = false

    console.log('core: Updating Labels...')

    const unlabelledPosts = await dbClient.getUnlabelledPostsWithMedia(
      300,
      interval,
    )

    if (unlabelledPosts.length === 0) continue

    const chunkSize = 25

    const postEntries: { uri: string; labels: string[] }[] = []

    for (let i = 0; i < unlabelledPosts.length; i += chunkSize) {
      const chunk = unlabelledPosts.slice(i, i + chunkSize).flatMap((item) => {
        return [item.uri]
      })

      let res: any

      try {
        res = await limit(() => agent.app.bsky.feed.getPosts({ uris: chunk }))
      } catch (e) {
        console.log('core: Error fetching posts, skipping chunk...')
        continue
      }

      const posts = res.data.posts

      if (posts.length === 0) {
        chunk.forEach((uri) => {
          postEntries.push({ uri: uri, labels: [] })
        })
      }

      for (let k = 0; k < posts.length; k++) {
        const labels: string[] = []
        if (posts[k].labels.length !== 0) {
          posts[k].labels.forEach((label) => {
            labels.push(label.val)
          })
        }
        postEntries.push({ uri: posts[k].uri, labels: labels })
      }
    }
    dbClient.updateLabelsForURIs(postEntries)
  }
}
