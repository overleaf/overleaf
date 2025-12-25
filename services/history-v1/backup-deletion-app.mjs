// @ts-check
// Metrics must be initialized before importing anything else
import '@overleaf/metrics/initialize.js'
import http from 'node:http'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import express from 'express'
import logger from '@overleaf/logger'
import Metrics from '@overleaf/metrics'
import { hasValidBasicAuthCredentials } from './api/middleware/security.js'
import {
  deleteProjectBackupCb,
  healthCheck,
  healthCheckCb,
  NotReadyToDelete,
} from './storage/lib/backupDeletion.mjs'
import { mongodb } from './storage/index.js'

const app = express()

logger.initialize('history-v1-backup-deletion')
Metrics.open_sockets.monitor()
Metrics.injectMetricsRoute(app)
app.use(Metrics.http.monitor(logger))
Metrics.leaked_sockets.monitor(logger)
Metrics.event_loop.monitor(logger)
Metrics.memory.monitor(logger)

function basicAuth(req, res, next) {
  if (hasValidBasicAuthCredentials(req)) return next()
  res.setHeader('WWW-Authenticate', 'Basic realm="Application"')
  res.sendStatus(401)
}

app.delete('/project/:projectId/backup', basicAuth, (req, res, next) => {
  deleteProjectBackupCb(req.params.projectId, err => {
    if (err) {
      return next(err)
    }
    res.sendStatus(204)
  })
})

app.get('/status', (req, res) => {
  res.send('history-v1-backup-deletion is up')
})

app.get('/health_check', (req, res, next) => {
  healthCheckCb(err => {
    if (err) return next(err)
    res.sendStatus(200)
  })
})

app.use((err, req, res, next) => {
  req.logger.addFields({ err })
  if (err instanceof NotReadyToDelete) {
    req.logger.setLevel('warn')
    return res.status(422).send(err.message)
  }
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
  const PORT = parseInt(process.env.PORT || '3101', 10)
  await startApp(PORT)
}
