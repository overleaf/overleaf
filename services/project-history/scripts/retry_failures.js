import * as RetryManager from '../app/js/RetryManager.js'
import minimist from 'minimist'

const args = minimist(process.argv.slice(2), {
  string: ['failureType', 'timeout', 'limit'],
  default: {
    failureType: 'soft',
    timeout: (60 * 60 * 1000).toString(),
    limit: (100_000).toString(),
  },
})

const failureType = args.failureType
const timeout = parseInt(args.timeout, 10)
const limit = parseInt(args.limit, 10)

RetryManager.retryFailures({ failureType, timeout, limit }, (err, result) => {
  if (err) {
    console.error(err)
    process.exit(1)
  } else {
    console.log(JSON.stringify(result))
    console.log('Done.')
  }
  process.exit(0)
})
