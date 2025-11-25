// @ts-check
// Metrics must be initialized before importing anything else
import '@overleaf/metrics/initialize.js'
import http from 'node:http'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import express from 'express'
import logger from '@overleaf/logger'
import Metrics from '@overleaf/metrics'
import { expressify } from '@overleaf/promise-utils'
import { healthCheck } from './storage/scripts/backup_worker.mjs'
const app = express()

logger.initialize('history-v1-backup-worker')
Metrics.open_sockets.monitor()
Metrics.injectMetricsRoute(app)
app.use(Metrics.http.monitor(logger))
Metrics.leaked_sockets.monitor(logger)
Metrics.event_loop.monitor(logger)
Metrics.memory.monitor(logger)

app.get('/status', (req, res) => {
  res.send('history-v1-backup-worker is up')
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

async function triggerGracefulShutdown(server, signal) {
  logger.info({ signal }, 'graceful shutdown: started shutdown sequence')
  server.close(function () {
    logger.info({ signal }, 'graceful shutdown: closed server')
    setTimeout(() => {
      process.exit(0)
    }, 1000)
  })
}

/**
 * @param {number} port
 * @return {Promise<http.Server>}
 */
export async function startApp(port) {
  await healthCheck()
  const server = http.createServer(app)
  await promisify(server.listen.bind(server, port))()
  const signals = ['SIGINT', 'SIGTERM']
  signals.forEach(signal => {
    process.on(signal, () => triggerGracefulShutdown(server, signal))
  })
  return server
}

// Run this if we're called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const PORT = parseInt(process.env.PORT || '3103', 10)
  await startApp(PORT)
}
