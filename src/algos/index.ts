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

import * as external from './externalList'
import * as twelveWords from './twelve-words'

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
  [external.shortname]: {
    handler: <AlgoHandler>external.handler,
    manager: external.manager,
  },
  ['aaaolsp7e26zo']: {
    // originally a skyfeed feed, so re-using the key
    handler: <AlgoHandler>twelveWords.handler,
    manager: twelveWords.manager,
  },
}

export default algos
