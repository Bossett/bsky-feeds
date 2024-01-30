import { pRateLimit } from 'p-ratelimit'

const limit = pRateLimit({
  interval: 300 * 1000,
  rate: 2000,
  concurrency: 10,
  maxDelay: 30 * 1000,
})

export default limit
