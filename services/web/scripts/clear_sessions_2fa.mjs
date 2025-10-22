import { promisify, promiseMapWithLimit } from '@overleaf/promise-utils'
import UserSessionsRedis from '../app/src/Features/User/UserSessionsRedis.mjs'
import minimist from 'minimist'
import { scriptRunner } from './lib/ScriptRunner.mjs'

const rClient = UserSessionsRedis.client()

const args = minimist(process.argv.slice(2))
const CURSOR = args.cursor
const COMMIT = args.commit === 'true'
const CONCURRENCY = parseInt(args.concurrency, 10) || 50
const LOG_EVERY_IN_S = parseInt(args['log-every-in-s'], 10) || 5

function shouldDelete(session) {
  if (session.twoFactorAuthenticationPendingUser) {
    // twoFactorAuthenticationPendingUserId migration
    return true
  }

  // default: keep
  return false
}

async function processSession(key) {
  if (!key || !key.startsWith('sess:')) {
    throw new Error(`unexpected session key: ${key}`)
  }

  const blob = await rClient.get(key)
  if (!blob) return false // expired or deleted
  const session = JSON.parse(blob)

  if (shouldDelete(session)) {
    const deleteLabel = COMMIT ? 'delete' : 'would delete'
    console.warn(deleteLabel, key)
    if (COMMIT) {
      await rClient.del(key)
    }
    return true
  }
  return false
}

async function main() {
  console.warn({ COMMIT, CONCURRENCY, CURSOR, LOG_EVERY_IN_S })
  console.warn('starting in 10s')
  await promisify(setTimeout)(10_000)

  let processed = 0
  let deleted = 0
  function logProgress() {
    const deletedLabel = COMMIT ? 'deleted' : 'would have deleted'
    console.log(
      `processed ${processed} | ${deletedLabel} ${deleted} | cursor ${cursor}`
    )
  }

  let cursor = CURSOR
  let lastLog = 0
  while (cursor !== '0') {
    let keys
    ;[cursor, keys] = await rClient.scan(cursor || 0, 'MATCH', 'sess:*')

    const results = await promiseMapWithLimit(CONCURRENCY, keys, processSession)
    processed += keys.length
    for (const r of results) {
      if (r) deleted++
    }
    if (Date.now() - lastLog >= LOG_EVERY_IN_S * 1000) {
      logProgress()
      lastLog = Date.now()
    }
  }
  logProgress()
  console.log('Done.')
  await rClient.disconnect()
}

try {
  await scriptRunner(main)
} catch (error) {
  console.error(error)
  process.exit(1)
}
