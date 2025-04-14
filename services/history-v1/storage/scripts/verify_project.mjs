import commandLineArgs from 'command-line-args'
import { verifyProjectWithErrorContext } from '../lib/backupVerifier.mjs'
import knex from '../lib/knex.js'
import { client } from '../lib/mongodb.js'
import redis from '../lib/redis.js'
import { setTimeout } from 'node:timers/promises'
import { loadGlobalBlobs } from '../lib/blob_store/index.js'

const { historyId } = commandLineArgs([{ name: 'historyId', type: String }])

async function gracefulShutdown(code = process.exitCode) {
  await knex.destroy()
  await client.close()
  await redis.disconnect()
  await setTimeout(1_000)
  process.exit(code)
}

if (!historyId) {
  console.error('missing --historyId')
  process.exitCode = 1
  await gracefulShutdown()
}

await loadGlobalBlobs()

try {
  await verifyProjectWithErrorContext(historyId)
  console.log('OK')
} catch (error) {
  console.error('error verifying', error)
  process.exitCode = 1
} finally {
  await gracefulShutdown()
}
