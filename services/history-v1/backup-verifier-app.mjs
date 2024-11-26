// @ts-check
// Metrics must be initialized before importing anything else
import '@overleaf/metrics/initialize.js'
import http from 'node:http'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import express from 'express'
import logger from '@overleaf/logger'
import Metrics from '@overleaf/metrics'
import {
  BackupCorruptedError,
  healthCheck,
  verifyBlob,
} from './storage/lib/backupVerifier.mjs'
import { mongodb } from './storage/index.js'
import { expressify } from '@overleaf/promise-utils'
import { Blob } from 'overleaf-editor-core'

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

/**
 * @param {number} port
 * @return {Promise<http.Server>}
 */
export async function startApp(port) {
  await mongodb.client.connect()
  await healthCheck()
  const server = http.createServer(app)
  await promisify(server.listen.bind(server, port))()
  return server
}

// Run this if we're called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const PORT = parseInt(process.env.PORT || '3102', 10)
  await startApp(PORT)
}
