import { QueryParams } from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import { AppContext } from '../config'
import { AlgoManager } from '../addn/algoManager'
import dotenv from 'dotenv'
import { Post } from '../db/schema'
import dbClient from '../db/dbClient'
import getUserDetails from '../addn/getUserDetails'

dotenv.config()

// max 15 chars
export const shortname = 'salesforce'

export const handler = async (ctx: AppContext, params: QueryParams) => {
  const builder = await dbClient.getLatestPostsForTag(
    shortname,
    params.limit,
    params.cursor,
  )

  let feed = builder.map((row) => ({
    post: row.uri,
  }))

  let cursor: string | undefined
  const last = builder.at(-1)
  if (last) {
    cursor = `${new Date(last.indexedAt).getTime()}::${last.cid}`
  }

  return {
    cursor,
    feed,
  }
}

export class manager extends AlgoManager {
  public name: string = shortname

  public matchTerms: string[] = [
    '#Salesforce',
    '#DF23',
    'Salesforce',
    '$CRM',
    'Marketing Cloud',
    'Sales Cloud',
    'Media Cloud',
    'Automotive Cloud',
    'Trailblazers',
    'Trailblazer',
    'Commerce Cloud',
    'Data Cloud',
    '#SalesforceSaturday',
    '#TrailblazerCommunity',
    'Tableau',
    'Salesforce+',
    'Marc Benioff',
    'Dreamforce',
    'AwesomeAdmin',
    'Trailhead',
  ]

  public matchPatterns: RegExp[] = [
    /(^|[\s\W])Salesforce($|[\W\s])/im,
    /(^|[\s\W])Dreamforce($|[\W\s])/im,
  ]

  // Include Argentinian users here to always include their posts
  public matchUsers: string[] = [
    //
  ]

  // Exclude posts from these users
  public bannedUsers: string[] = [
    //
  ]

  public async periodicTask() {
    await this.db.removeTagFromOldPosts(
      this.name,
      new Date().getTime() - 7 * 24 * 60 * 60 * 1000,
    )
  }

  public async filter_post(post: Post): Promise<Boolean> {
    if (post.author === 'did:plc:mcb6n67plnrlx4lg35natk2b') return false // sorry nowbreezing.ntw.app
    if (this.agent === null) {
      await this.start()
    }
    if (this.agent === null) return false

    let match = false

    let matchString = ''
    let matchDescription = ''

    if (post.embed?.images) {
      const imagesArr = post.embed.images
      imagesArr.forEach((image) => {
        matchString = `${matchString} ${image.alt}`.replace('\n', ' ')
      })
    }

    matchString = `${post.text} ${matchString}`.replace('\n', ' ')

    this.matchPatterns.forEach((pattern) => {
      if (matchString.match(pattern) !== null) {
        match = true
      }
    })

    this.matchTerms.forEach((term) => {
      if (matchString.match(term) !== null) {
        match = true
      }
    })

    this.matchUsers.forEach((user) => {
      if (matchString.match(user) !== null) {
        match = true
      }
    })

    // commenting it because of rate limits
    // const details = await getUserDetails(post.author, this.agent)
    // matchDescription = `${details.description} ${details.displayName}`.replace('\n', ' ')

    this.matchTerms.forEach((term) => {
      if (matchDescription.match(term) !== null) {
        match = true
      }
    })

    return match
  }
}
