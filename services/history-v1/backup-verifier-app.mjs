// @ts-check
// Metrics must be initialized before importing anything else
import '@overleaf/metrics/initialize.js'
import http from 'node:http'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { setTimeout } from 'node:timers/promises'
import express from 'express'
import logger from '@overleaf/logger'
import Metrics from '@overleaf/metrics'
import { healthCheck } from './backupVerifier/healthCheck.mjs'
import {
  BackupCorruptedError,
  verifyBlob,
} from './storage/lib/backupVerifier.mjs'
import { mongodb } from './storage/index.js'
import { expressify } from '@overleaf/promise-utils'
import { Blob } from 'overleaf-editor-core'
import { loadGlobalBlobs } from './storage/lib/blob_store/index.js'
import { EventEmitter } from 'node:events'
import {
  loopRandomProjects,
  setWriteMetrics,
} from './backupVerifier/ProjectVerifier.mjs'

const app = express()

logger.initialize('history-v1-backup-verifier')
Metrics.open_sockets.monitor()
Metrics.injectMetricsRoute(app)
app.use(Metrics.http.monitor(logger))
Metrics.leaked_sockets.monitor(logger)
Metrics.event_loop.monitor(logger)
Metrics.memory.monitor(logger)

app.get(
  '/history/:historyId/blob/:hash/verify',
  expressify(async (req, res) => {
    const { historyId, hash } = req.params
    try {
      await verifyBlob(historyId, hash)
      res.sendStatus(200)
    } catch (err) {
      logger.warn({ err, historyId, hash }, 'manual verify blob failed')
      if (err instanceof Blob.NotFoundError) {
        res.status(404).send(err.message)
      } else if (err instanceof BackupCorruptedError) {
        res.status(422).send(err.message)
      } else {
        throw err
      }
    }
  })
)

app.get('/status', (req, res) => {
  res.send('history-v1-backup-verifier is up')
})

app.get(
  '/health_check',
  expressify(async (req, res) => {
    await healthCheck()
    res.sendStatus(200)
  })
)

app.use((err, req, res, next) => {
  req.logger.addFields({ err })
  req.logger.setLevel('error')
  next(err)
})

const shutdownEmitter = new EventEmitter()

shutdownEmitter.once('shutdown', async code => {
  logger.info({ code }, 'shutting down')
  await mongodb.client.close()
  await setTimeout(100)
  process.exit(code)
})

process.on('SIGTERM', () => {
  shutdownEmitter.emit('shutdown', 0)
})

process.on('SIGINT', () => {
  shutdownEmitter.emit('shutdown', 0)
})

/**
 * @param {number} port
 * @param {boolean} enableVerificationLoop
 * @return {Promise<http.Server>}
 */
export async function startApp(port, enableVerificationLoop = true) {
  await mongodb.client.connect()
  await loadGlobalBlobs()
  await healthCheck()
  const server = http.createServer(app)
  await promisify(server.listen.bind(server, port))()
  enableVerificationLoop && loopRandomProjects(shutdownEmitter)
  return server
}

setWriteMetrics(true)

// Run this if we're called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const PORT = parseInt(process.env.PORT || '3102', 10)
  try {
    await startApp(PORT)
  } catch (error) {
    shutdownEmitter.emit('shutdown', 1)
    logger.error({ error }, 'error starting app')
  }
}
