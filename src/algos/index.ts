import { AppContext } from '../config'
import {
  QueryParams,
  OutputSchema as AlgoOutput,
} from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import * as forScience from './for-science'
import * as ausPol from './auspol'
import * as dads from './dads'
import * as EighteenPlusND from './18-plus-nd'
import * as ND from './nd'
import * as discourse from './discourse'
import * as elusive from './elusive'

type AlgoHandler = (ctx: AppContext, params: QueryParams) => Promise<AlgoOutput>

const algos = {
  [forScience.shortname]: {
    handler: <AlgoHandler>forScience.handler,
    manager: forScience.manager,
  },
  [ausPol.shortname]: {
    handler: <AlgoHandler>ausPol.handler,
    manager: ausPol.manager,
  },
  [dads.shortname]: {
    handler: <AlgoHandler>dads.handler,
    manager: dads.manager,
  },
  [EighteenPlusND.shortname]: {
    handler: <AlgoHandler>EighteenPlusND.handler,
    manager: EighteenPlusND.manager,
  },
  [ND.shortname]: {
    handler: <AlgoHandler>ND.handler,
    manager: ND.manager,
  },
  [discourse.shortname]: {
    handler: <AlgoHandler>discourse.handler,
    manager: discourse.manager,
  },
  [elusive.shortname]: {
    handler: <AlgoHandler>elusive.handler,
    manager: elusive.manager,
  },
}

export default algos
