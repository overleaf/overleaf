import { setTimeout } from 'node:timers/promises'
import { Chunk } from 'overleaf-editor-core'
import logger from '@overleaf/logger'
import Metrics from '@overleaf/metrics'
import HistoryManager from './HistoryManager.mjs'

/**
 * @import { Snapshot } from 'overleaf-editor-core'
 */

const READ_ATTEMPTS = 3
const READ_RETRY_DELAY_MS = 100

/**
 * Read from history, repeating the request if it fails.
 *
 * Retried on any failure, an error status included: history answering 500 to one
 * request says no more about the next one than a connection that was dropped
 * does.
 *
 * @template T
 * @param {string} metricName
 * @param {string} msg - logged with the error on each retry
 * @param {object} info - logged with the error on each retry
 * @param {() => Promise<T>} fn
 * @return {Promise<T>}
 */
async function withRetries(metricName, msg, info, fn) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if (attempt === READ_ATTEMPTS) throw err
      Metrics.inc(metricName)
      logger.warn({ err, attempt, ...info }, `${msg}, retrying`)
      await setTimeout(attempt * READ_RETRY_DELAY_MS)
    }
  }
}

/**
 * Load the project's latest chunk.
 *
 * @param {string} historyId
 * @return {Promise<Chunk>}
 */
async function fetchLatestChunk(historyId) {
  const { chunk } = await withRetries(
    'history_ot_chunk_fetch_retry',
    'failed to get the latest history chunk',
    { historyId },
    () => HistoryManager.promises.getLatestHistoryWithHistoryId(historyId)
  )
  return Chunk.fromRaw(chunk)
}

/**
 * The project's latest snapshot, and the version it is of.
 *
 * @param {string} historyId
 * @return {Promise<{snapshot: Snapshot, version: number}>}
 */
export async function getLatestSnapshot(historyId) {
  const chunk = await fetchLatestChunk(historyId)
  const snapshot = chunk.getSnapshot()
  snapshot.applyAll(chunk.getChanges())
  return { snapshot, version: chunk.getEndVersion() }
}
