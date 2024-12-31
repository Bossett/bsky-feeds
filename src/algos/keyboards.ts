import { QueryParams } from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import { AppContext } from '../config'
import { AlgoManager } from '../addn/algoManager'
import dotenv from 'dotenv'
import { Post } from '../db/schema'
import dbClient from '../db/dbClient'

import { BskyAgent } from '@atproto/api'
import { Database } from '../db'

dotenv.config()

// max 15 chars
export const shortname = 'keyboards'

export const handler = async (ctx: AppContext, params: QueryParams) => {
  const builder = await dbClient.getLatestPostsForTag({
    tag: shortname,
    limit: params.limit,
    cursor: params.cursor,
  })

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
    'ajazz',
    // 'akko',
    'alexotos',
    'alice layout',
    'alu plate',
    'arisu layout',
    // 'alps',
    'beamspring',
    'boba u4',
    'box jade',
    'box navy',
    'brown switch',
    'buckling spring',
    'bysellfwrdd',
    'cepstrum',
    'cf plate',
    '(cherry|mx) black',
    '(cherry|mx) blue',
    '(cherry|mx) brown',
    'cherry mx',
    '(cherry|mx) reds',
    'choc switch',
    // 'clacky',
    'clickbar',
    'clicky switch',
    'colemak dh',
    'colemak',
    'dcx',
    'deskthority',
    'dolch',
    'dolice',
    'domikey',
    'durock',
    'epomaker',
    '(ergo|ergonomic) (kb|keyboard)',
    'ferris (bling|compact|high|mini|sweep)',
    'foam mod',
    'fysellfwrdd',
    'gasket mod',
    'gasket mount',
    'gateron',
    'gazzew',
    'geekhack',
    'geon',
    'gmk',
    'gmmk',
    'group buy',
    'haimu',
    'hall effect switch',
    'hand wired (kb|keyboard)',
    'hhkb',
    'hipyo',
    'holee mod',
    'holy panda',
    'ibm model f',
    'ibm model m',
    'kaihua',
    'kailh',
    'kbdfans',
    'keeb',
    'keycaps',
    'keychron',
    'keycult',
    'keykobo',
    'keymap',
    'lemokey',
    'linear switch',
    '(mech|mechanical) keyboard',
    'melgeek',
    'microsoft natural key',
    'model f',
    'model m',
    'monokei',
    'monsgeek',
    'mt3',
    'mtnu',
    'mysellfwrdd',
    'mx switch',
    'näppäimistö',
    // 'nixie',
    'nixies',
    'norbauer',
    'novelkeys',
    'olkb',
    'ortholinear (kb|keyboard)',
    'ortho (kb|keyboard)',
    'outemu',
    'pbtfans',
    'pom plate',
    'QMK',
    'QWERTY layout',
    'red switch',
    'sofle',
    'solderless',
    'split (kb|keyboard)',
    'split staggered',
    'staggered layout',
    'switch film',
    'switch lube',
    'switch mod',
    'switch opener',
    'switch pads',
    // 'switch plate',
    'tactile switch',
    'taeha',
    'tape mod',
    'tangentbord',
    'tenkeyless',
    'tent(ing)? angle',
    'tgr 910',
    'tgr jane',
    'theremingoat',
    // 'thock(y)?',
    'tkl',
    'topre',
    'unicomp',
    'WKL',
    'zealpc',
    'zfrontier',
    'ZMK',
  ]

  public re: RegExp

  constructor(db: Database, agent: BskyAgent) {
    super(db, agent)
    this.re = new RegExp(
      `^(?!.*\\b((swiss|french|italian|austrian) alps|mountain(s)?|dice)\\b).*\\b(${this.matchTerms.join(
        '|',
      )})(es|s)?\\b.*$`,
      'ims',
    )
  }

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

    let matchString = ''

    if (post.embed?.images) {
      const imagesArr = post.embed.images
      imagesArr.forEach((image) => {
        matchString = `${matchString} ${image.alt}`.replace('\n', ' ')
      })
    }

    if (post.embed?.alt) {
      matchString = `${matchString} ${post.embed.alt}`.replace('\n', ' ')
    }

    if (post.embed?.media?.alt) {
      matchString = `${matchString} ${post.embed?.media?.alt}`.replace(
        '\n',
        ' ',
      )
    }
    matchString = `${post.text} ${matchString}`.replace('\n', ' ')

    if (matchString.match(this.re) !== null) {
      return true
    }

    return false
  }
}
