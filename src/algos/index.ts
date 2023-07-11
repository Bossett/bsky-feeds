import { AppContext } from '../config'
import {
  QueryParams,
  OutputSchema as AlgoOutput,
} from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import * as forScience from './for-science'
import * as ausPol from './auspol'
import * as dads from './dads'
import * as EighteenPlusND from './18-plus-nd'
import * as discourse from './discourse'

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
  [discourse.shortname]: {
    handler: <AlgoHandler>discourse.handler,
    manager: discourse.manager,
  },
}

export default algos
