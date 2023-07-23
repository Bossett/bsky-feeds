import dbClient from '../db/dbClient'

export default async function batchUpdate(agent, interval) {
  while (true) {
    console.log('core: updating...')

    await new Promise((resolve) => setTimeout(resolve, 5000)) // interval))

    const unlabelledPosts = await dbClient.getUnlabelledPostsWithImages(100)

    if (unlabelledPosts.length === 0) continue

    const chunkSize = 25

    for (let i = 0; i < unlabelledPosts.length; i += chunkSize) {
      const chunk = unlabelledPosts.slice(i, i + chunkSize).flatMap((item) => {
        return [item.uri]
      })
      const res = await agent.app.bsky.feed.getPosts({ uris: chunk })

      const posts = res.data.posts

      for (let k = 0; k < posts.length; k++) {
        if (posts[k].labels.length !== 0) {
          posts[k].labels.forEach((label) => {
            console.log(`${label.uri} has label ${label.val}`)
          })
        }
      }
    }
  }
}
