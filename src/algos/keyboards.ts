import { QueryParams } from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import { AppContext } from '../config'
import { AlgoManager } from '../addn/algoManager'
import dotenv from 'dotenv'
import { Post } from '../db/schema'
import dbClient from '../db/dbClient'

dotenv.config()

// max 15 chars
export const shortname = 'keyboards'

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
    '⌨️',
    'ajazz',
    // 'alps',
    'beamspring',
    'brown switch',
    'buckling spring',
    'bysellfwrdd',
    'cepstrum',
    'cherry mx',
    'clacky',
    'clickbar',
    'clicky switch',
    'colemak dh',
    'colemak',
    'dolch',
    'durock',
    'ergonomic (kb|keyboard)',
    'foam mod',
    'fysellfwrdd',
    'gasket mod',
    'gateron',
    'gmk',
    'hall effect switch',
    'hand wired (kb|keyboard)',
    'hhkb',
    'holy panda',
    'ibm model f',
    'ibm model m',
    'kaihua',
    'kailh',
    'kailh',
    'keeb',
    'keycaps',
    'keychron',
    'linear switch',
    'mechanical keyboard',
    'microsoft natural key',
    'model f',
    'model m',
    'mysellfwrdd',
    'näppäimistö',
    'novelkeys',
    'olkb',
    'ortholinear (kb|keyboard)',
    'outemu',
    'QMK',
    'QWERTY',
    'red switch',
    'solderless',
    'split (kb|keyboard)',
    'split staggered',
    'staggered layout',
    'switch film',
    'switch lube',
    'switch mod',
    'switch opener',
    'switch pads',
    'switch plate',
    'tactile switch',
    'tangentbord',
    'tenkeyless',
    'tent(ing)? angle',
    'theremingoat',
    'thock(y)?',
    'topre',
    'unicomp',
    'zealpc',
  ]

  public re = new RegExp(
    `^(?!.*\b((swiss|french|italian|austrian) alps|mountain(s)?|dice)\b).*\b(${this.matchTerms.join(
      '|',
    )})(es|s)?\b.*$`,
    'ims',
  )

  public async periodicTask() {
    await this.db.removeTagFromOldPosts(
      this.name,
      new Date().getTime() - 7 * 24 * 60 * 60 * 1000,
    )
  }

  public async filter_post(post: Post): Promise<Boolean> {
    if (post.author === 'did:plc:mcb6n67plnrlx4lg35natk2b') return false // sorry nowbreezing.ntw.app
    if (post.replyRoot !== null) return false
    if (this.agent === null) {
      await this.start()
    }
    if (this.agent === null) return false

    let match = false

    let matchString = ''

    if (post.embed?.images) {
      const imagesArr = post.embed.images
      imagesArr.forEach((image) => {
        matchString = `${matchString} ${image.alt}`.replace('\n', ' ')
      })
    }

    matchString = `${post.text} ${matchString}`.replace('\n', ' ')

    if (matchString.match(this.re) !== null) {
      match = true
    }

    return match
  }
}
