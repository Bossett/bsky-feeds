import { pRateLimit } from 'p-ratelimit'

const _limit = pRateLimit({
  interval: 300 * 1000,
  rate: 2000,
  concurrency: 10,
  maxDelay: 30 * 1000,
})

const limit = async <T>(fn: () => Promise<T>): Promise<T> => {
  try {
    return await _limit(fn)
  } catch (error) {
    console.log(`error in limited call:\n${fn.toString()}\n${error}`)
    throw error
  }
}

export default limit
