import { AppContext } from '../config'
import {
  QueryParams,
  OutputSchema as AlgoOutput,
} from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import * as forScience from './for-science'

type AlgoHandler = (ctx: AppContext, params: QueryParams) => Promise<AlgoOutput>

const algos = {
  [forScience.shortname]: {
    handler: <AlgoHandler>forScience.handler,
    manager: forScience.manager,
  },
}

export default algos
