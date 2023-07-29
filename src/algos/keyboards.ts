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
  public re =
    /\b(clacky|mechanical keyboard|brown switch|tenkeyless|red switch|microsoft natural key|solderless|thock(y)?|gateron|kailh|kaihua|theremingoat|cherry mx|tactile switch|linear switch|clicky switch|zealpc|alps|holy panda|durock|outemu|ajazz|keycaps|gmk|novelkeys|clickbar|split (kb|keyboard)|olkb|ortholinear (kb|keyboard)|ergonomic (kb|keyboard)|foam mod|switch mod|switch plate|switch film|switch lube|switch opener|switch pads|kailh|gasket mod|hand wired (kb|keyboard)|tent(ing)? angle|staggered layout|split staggered|QMK|QWERTY|colemak|colemak dh|hhkb|topre|cepstrum|⌨️|ibm model m|ibm model f|unicomp|model m|model f|beamspring|buckling spring|hall effect switch)(es|s)?\b/ims

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
