import { AppContext } from '../config'
import {
  QueryParams,
  OutputSchema as AlgoOutput,
} from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import * as uruguay from './uruguay'
import * as argentina from './argentina'
import * as riodelaplata from './riodelaplata'
import * as salesforce from './salesforce'
import * as fediverse from './fediverse'
import * as forScience from './for-science'
import * as ausPol from './auspol'
import * as dads from './dads'
import * as dadsMedia from './dads-media'
import * as EighteenPlusND from './18-plus-nd'
import * as ND from './nd'
import * as discourse from './discourse'
import * as cats from './cats'
import * as elusive from './elusive'
import * as keyboards from './keyboards'
import * as overheard from './overheard'
import * as paxaus from './paxaus'

type AlgoHandler = (ctx: AppContext, params: QueryParams) => Promise<AlgoOutput>

const algos = {
  [uruguay.shortname]: {
    handler: <AlgoHandler>uruguay.handler,
    manager: uruguay.manager,
  },
  [argentina.shortname]: {
    handler: <AlgoHandler>argentina.handler,
    manager: argentina.manager,
  },
  [riodelaplata.shortname]: {
    handler: <AlgoHandler>riodelaplata.handler,
    manager: riodelaplata.manager,
  },
  [salesforce.shortname]: {
    handler: <AlgoHandler>salesforce.handler,
    manager: salesforce.manager,
  },
  [fediverse.shortname]: {
    handler: <AlgoHandler>fediverse.handler,
    manager: fediverse.manager,
  },
  [paxaus.shortname]: {
    handler: <AlgoHandler>paxaus.handler,
    manager: paxaus.manager,
  },
}

export default algos
