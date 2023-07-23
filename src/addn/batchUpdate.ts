import dbClient from '../db/dbClient'

export default async function batchUpdate(agent, interval) {
  while (true) {
    console.log('core: updating...')

    await new Promise((resolve) => setTimeout(resolve, interval))

    const unlabelledPosts = await dbClient.getUnlabelledPostsWithImages(
      100,
      interval,
    )

    if (unlabelledPosts.length === 0) continue

    const chunkSize = 25

    const postEntries: { uri: string; labels: string[] }[] = []

    for (let i = 0; i < unlabelledPosts.length; i += chunkSize) {
      const chunk = unlabelledPosts.slice(i, i + chunkSize).flatMap((item) => {
        return [item.uri]
      })
      const res = await agent.app.bsky.feed.getPosts({ uris: chunk })

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
