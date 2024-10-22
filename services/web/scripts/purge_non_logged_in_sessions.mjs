import RedisWrapper from '@overleaf/redis-wrapper'
import Settings from '@overleaf/settings'
import SessionManager from '../app/src/Features/Authentication/SessionManager.js'
import minimist from 'minimist'

const redis = RedisWrapper.createClient(Settings.redis.websessions)

const argv = minimist(process.argv.slice(2), {
  string: ['count'],
  boolean: ['dry-run', 'help'],
  alias: {
    count: 'c',
    'dry-run': 'n',
    help: 'h',
  },
})

if (argv.help) {
  console.log(
    `Usage: node purge_non_logged_in_sessions.js [--count <count>] [--dry-run]
  --count <count> the number of keys to scan on each iteration (default 1000)
  --dry-run to not delete any keys
  --help to show this help

Note: use --count=10000 to delete faster (this will impact redis performance,
so use with caution)`
  )
  process.exit()
}

const scanCount = argv.count ? parseInt(argv.count, 10) : 1000
const dryRun = argv['dry-run']

console.log(`Scan count set to ${scanCount}`)

if (dryRun) {
  console.log('Dry run, not deleting any keys')
}

// iterate over all redis keys matching sess:* and delete the ones
// that are not logged in using async await and mget and mdel
async function scanAndPurge() {
  let totalSessions = 0
  let totalDeletedSessions = 0
  const stream = redis.scanStream({
    match: 'sess:*',
    count: scanCount,
  })
  console.log('Starting scan...')
  for await (const resultKeys of stream) {
    if (resultKeys.length === 0) {
      continue // scan is allowed to return zero elements, the client should not consider the iteration complete
    }
    console.log(`Keys found, count: ${resultKeys.length}`)
    totalSessions += resultKeys.length
    const sessions = await redis.mget(resultKeys)
    const toDelete = []
    for (let i = 0; i < sessions.length; i++) {
      const resultKey = resultKeys[i]
      const session = sessions[i]
      if (!session) {
        continue
      }
      try {
        const sessionObject = JSON.parse(session)
        if (!SessionManager.isUserLoggedIn(sessionObject)) {
          totalDeletedSessions++
          toDelete.push(resultKey)
        }
      } catch (error) {
        console.error(`Error parsing session ${resultKeys[i]}: ${error}`)
      }
    }
    if (toDelete.length === 0) {
      continue
    }
    if (dryRun) {
      console.log(`Would delete ${toDelete.length} keys`)
    } else {
      await redis.del(toDelete)
      console.log(`Keys deleted so far: ${totalDeletedSessions}`)
    }
  }
  if (dryRun) {
    console.log(
      `Dry run: ${totalSessions} sessions checked, ${totalDeletedSessions} would have been deleted`
    )
  } else {
    console.log(
      `All ${totalSessions} sessions have been checked, ${totalDeletedSessions} deleted`
    )
  }
  redis.quit()
}

try {
  await scanAndPurge()
} catch (error) {
  console.error(error)
  process.exit()
}
