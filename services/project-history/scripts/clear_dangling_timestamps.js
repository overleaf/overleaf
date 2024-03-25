#!/usr/bin/env node

// Clear timestamps which don't have any corresponding history ops
// usage: scripts/flush_all.js <limit>

import logger from '@overleaf/logger'
import * as RedisManager from '../app/js/RedisManager.js'

const argv = process.argv.slice(2)
const limit = parseInt(argv[0], 10) || null

// find all dangling timestamps and clear them
async function main() {
  logger.info(
    { limit },
    'running redis scan for project timestamps, this may take a while'
  )
  const projectIdsWithFirstOpTimestamps =
    await RedisManager.promises.getProjectIdsWithFirstOpTimestamps(limit)
  const totalTimestamps = projectIdsWithFirstOpTimestamps.length
  logger.info(
    { totalTimestamps },
    'scan completed, now clearing dangling timestamps'
  )
  let clearedTimestamps = 0
  let processed = 0
  for (const projectId of projectIdsWithFirstOpTimestamps) {
    const result =
      await RedisManager.promises.clearDanglingFirstOpTimestamp(projectId)
    processed++
    clearedTimestamps += result
    if (processed % 1000 === 0) {
      logger.info(
        { processed, totalTimestamps, clearedTimestamps },
        'clearing timestamps'
      )
    }
  }
  logger.info({ processed, totalTimestamps, clearedTimestamps }, 'completed')
  process.exit(0)
}

main()
