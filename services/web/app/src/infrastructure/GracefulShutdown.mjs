/*
  Graceful shutdown sequence:
  - Stop background tasks that depend on the DB, like redis queues
  - Stop processing new HTTP requests
  - Wait for background tasks that depend on the DB, like polling that was
     triggered by HTTP requests
  - Drain/Close db connections
  - Cleanup other background tasks, like metrics collectors
  - By now the node app should exit on its own.
 */

import logger from '@overleaf/logger'

import OError from '@overleaf/o-error'
import Settings from '@overleaf/settings'
import Metrics from '@overleaf/metrics'
import { setTimeout as sleep } from 'node:timers/promises'

const optionalCleanupHandlersBeforeStoppingTraffic = []
const requiredCleanupHandlersBeforeDrainingConnections = []
const optionalCleanupHandlersAfterDrainingConnections = []
const connectionDrainer = []

export function addConnectionDrainer(label, handler) {
  connectionDrainer.push({ label, handler })
}

export function addOptionalCleanupHandlerBeforeStoppingTraffic(label, handler) {
  optionalCleanupHandlersBeforeStoppingTraffic.push({ label, handler })
}

export function addRequiredCleanupHandlerBeforeDrainingConnections(
  label,
  handler
) {
  requiredCleanupHandlersBeforeDrainingConnections.push({ label, handler })
}

export function addOptionalCleanupHandlerAfterDrainingConnections(
  label,
  handler
) {
  optionalCleanupHandlersAfterDrainingConnections.push({ label, handler })
}

async function runHandlers(stage, handlers, logOnly) {
  logger.info({ stage }, 'graceful shutdown: run handlers')
  for (const { label, handler } of handlers) {
    try {
      await handler()
    } catch (e) {
      const err = OError.tag(e, 'handler failed', { stage, label })
      if (logOnly) {
        logger.err({ err }, 'graceful shutdown: incomplete cleanup')
      } else {
        throw err
      }
    }
  }
}

/**
 * @param {import('net').Server} [server]
 * @param {number|string} [signal]
 */
export async function gracefulShutdown(server, signal) {
  logger.warn({ signal }, 'graceful shutdown: started shutdown sequence')
  Settings.shuttingDown = true

  await runHandlers(
    'optionalBeforeStoppingTraffic',
    optionalCleanupHandlersBeforeStoppingTraffic,
    true
  )

  if (server) {
    await sleep(Settings.gracefulShutdownDelayInMs)
    try {
      await new Promise((resolve, reject) => {
        logger.warn({}, 'graceful shutdown: closing http server')
        server.close(err => {
          if (err) {
            reject(OError.tag(err, 'http.Server.close failed'))
          } else {
            resolve()
          }
        })
      })
    } catch (err) {
      throw OError.tag(err, 'stop traffic')
    }
  }

  await runHandlers(
    'requiredBeforeDrainingConnections',
    requiredCleanupHandlersBeforeDrainingConnections
  )

  try {
    await runHandlers('connectionDrainer', connectionDrainer)

    await runHandlers(
      'optionalAfterDrainingConnections',
      optionalCleanupHandlersAfterDrainingConnections.concat([
        { label: 'metrics module', handler: () => Metrics.close() },
      ])
    )
  } catch (err) {
    logger.err(
      { err },
      'graceful shutdown: failed after stopping traffic, exiting'
    )
    // wait for logs to flush
    await sleep(1000)
    process.exit(1)
    return
  }
  logger.info({}, 'graceful shutdown: ready to exit')
}

export function triggerGracefulShutdown(server, signal) {
  gracefulShutdown(server, signal).catch(err => {
    logger.err(
      { err },
      'graceful shutdown: incomplete cleanup, waiting for kill'
    )
  })
}

export class BackgroundTaskTracker {
  constructor(label) {
    // Do not leak any handles, just record the number of pending jobs.
    // In case we miss the cleanup of one job, the worst thing that can happen
    //  is that we do not stop web "gracefully" before k8s kills it forcefully.
    this.pendingBackgroundTasks = 0
    addRequiredCleanupHandlerBeforeDrainingConnections(label, async () => {
      while (this.pendingBackgroundTasks > 0) {
        await sleep(100) // try again in 100ms.
      }
    })
  }

  add() {
    this.pendingBackgroundTasks++
  }

  done() {
    this.pendingBackgroundTasks--
  }
}

export default {
  BackgroundTaskTracker,
  addConnectionDrainer,
  addOptionalCleanupHandlerBeforeStoppingTraffic,
  addOptionalCleanupHandlerAfterDrainingConnections,
  addRequiredCleanupHandlerBeforeDrainingConnections,
  triggerGracefulShutdown,
  gracefulShutdown,
}
