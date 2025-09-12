// Metrics must be initialized before importing anything else
require('@overleaf/metrics/initialize')

const Metrics = require('@overleaf/metrics')
const express = require('express')
const Settings = require('@overleaf/settings')
const logger = require('@overleaf/logger')
logger.initialize('document-updater')

logger.logger.addSerializers(require('./app/js/LoggerSerializers'))

const RedisManager = require('./app/js/RedisManager')
const DispatchManager = require('./app/js/DispatchManager')
const DeleteQueueManager = require('./app/js/DeleteQueueManager')
const Errors = require('./app/js/Errors')
const HttpController = require('./app/js/HttpController')
const mongodb = require('./app/js/mongodb')
const async = require('async')

const bodyParser = require('body-parser')

Metrics.event_loop.monitor(logger, 100)
Metrics.open_sockets.monitor()

const app = express()
app.use(bodyParser.json({ limit: Settings.maxJsonRequestSize }))
Metrics.injectMetricsRoute(app)

DispatchManager.createAndStartDispatchers(Settings.dispatcherCount)

app.get('/status', (req, res) => {
  if (Settings.shuttingDown) {
    return res.sendStatus(503) // Service unavailable
  } else {
    return res.send('document updater is alive')
  }
})

const pubsubClient = require('@overleaf/redis-wrapper').createClient(
  Settings.redis.pubsub
)
app.get('/health_check/redis', (req, res, next) => {
  pubsubClient.healthCheck(error => {
    if (error) {
      logger.err({ err: error }, 'failed redis health check')
      return res.sendStatus(500)
    } else {
      return res.sendStatus(200)
    }
  })
})

const docUpdaterRedisClient = require('@overleaf/redis-wrapper').createClient(
  Settings.redis.documentupdater
)
app.get('/health_check/redis_cluster', (req, res, next) => {
  docUpdaterRedisClient.healthCheck(error => {
    if (error) {
      logger.err({ err: error }, 'failed redis cluster health check')
      return res.sendStatus(500)
    } else {
      return res.sendStatus(200)
    }
  })
})

app.get('/health_check', (req, res, next) => {
  async.series(
    [
      cb => {
        pubsubClient.healthCheck(error => {
          if (error) {
            logger.err({ err: error }, 'failed redis health check')
          }
          cb(error)
        })
      },
      cb => {
        docUpdaterRedisClient.healthCheck(error => {
          if (error) {
            logger.err({ err: error }, 'failed redis cluster health check')
          }
          cb(error)
        })
      },
      cb => {
        mongodb.healthCheck(error => {
          if (error) {
            logger.err({ err: error }, 'failed mongo health check')
          }
          cb(error)
        })
      },
    ],
    error => {
      if (error) {
        return res.sendStatus(500)
      } else {
        return res.sendStatus(200)
      }
    }
  )
})

// record http metrics for the routes below this point
app.use(Metrics.http.monitor(logger))

app.param('project_id', (req, res, next, projectId) => {
  if (projectId != null && projectId.match(/^[0-9a-f]{24}$/)) {
    return next()
  } else {
    return next(new Error('invalid project id'))
  }
})

app.param('doc_id', (req, res, next, docId) => {
  if (docId != null && docId.match(/^[0-9a-f]{24}$/)) {
    return next()
  } else {
    return next(new Error('invalid doc id'))
  }
})

// Record requests that come in after we've started shutting down - for investigation.
app.use((req, res, next) => {
  if (Settings.shuttingDown) {
    logger.warn(
      { req, timeSinceShutdown: Date.now() - Settings.shutDownTime },
      'request received after shutting down'
    )
    // We don't want keep-alive connections to be kept open when the server is shutting down.
    res.set('Connection', 'close')
  }
  next()
})

app.get('/project/:project_id/doc/:doc_id', HttpController.getDoc)
app.get(
  '/project/:project_id/doc/:doc_id/comment/:comment_id',
  HttpController.getComment
)
app.get('/project/:project_id/doc/:doc_id/peek', HttpController.peekDoc)
app.get('/project/:project_id/ranges', HttpController.getProjectRanges)

// temporarily keep the GET method for backwards compatibility
app.get('/project/:project_id/doc', HttpController.getProjectDocsAndFlushIfOld)
// will migrate to the POST method of get_and_flush_if_old instead
app.post(
  '/project/:project_id/get_and_flush_if_old',
  HttpController.getProjectDocsAndFlushIfOld
)
app.get(
  '/project/:project_id/last_updated_at',
  HttpController.getProjectLastUpdatedAt
)
app.post('/project/:project_id/clearState', HttpController.clearProjectState)
app.post('/project/:project_id/doc/:doc_id', HttpController.setDoc)
app.post('/project/:project_id/doc/:doc_id/append', HttpController.appendToDoc)
app.post(
  '/project/:project_id/doc/:doc_id/flush',
  HttpController.flushDocIfLoaded
)
app.delete('/project/:project_id/doc/:doc_id', HttpController.deleteDoc)
app.delete('/project/:project_id', HttpController.deleteProject)
app.delete('/project', HttpController.deleteMultipleProjects)
app.post('/project/:project_id', HttpController.updateProject)
app.post(
  '/project/:project_id/history/resync',
  longerTimeout,
  HttpController.resyncProjectHistory
)
app.post('/project/:project_id/flush', HttpController.flushProject)
app.post(
  '/project/:project_id/doc/:doc_id/change/:change_id/accept',
  HttpController.acceptChanges
)
app.post(
  '/project/:project_id/doc/:doc_id/change/accept',
  HttpController.acceptChanges
)
app.post(
  '/project/:project_id/doc/:doc_id/change/reject',
  HttpController.rejectChanges
)
app.post(
  '/project/:project_id/doc/:doc_id/comment/:comment_id/resolve',
  HttpController.resolveComment
)
app.post(
  '/project/:project_id/doc/:doc_id/comment/:comment_id/reopen',
  HttpController.reopenComment
)
app.delete(
  '/project/:project_id/doc/:doc_id/comment/:comment_id',
  HttpController.deleteComment
)

app.post('/project/:project_id/block', HttpController.blockProject)
app.post('/project/:project_id/unblock', HttpController.unblockProject)

app.get('/flush_queued_projects', HttpController.flushQueuedProjects)

app.get('/total', (req, res, next) => {
  const timer = new Metrics.Timer('http.allDocList')
  RedisManager.getCountOfDocsInMemory((err, count) => {
    if (err) {
      return next(err)
    }
    timer.done()
    res.send({ total: count })
  })
})

app.use((error, req, res, next) => {
  if (error instanceof Errors.NotFoundError) {
    return res.sendStatus(404)
  } else if (error instanceof Errors.OpRangeNotAvailableError) {
    return res.status(422).json(error.info)
  } else if (error instanceof Errors.FileTooLargeError) {
    return res.sendStatus(413)
  } else if (error.statusCode === 413) {
    return res.status(413).send('request entity too large')
  } else {
    logger.error({ err: error, req }, 'request errored')
    return res.status(500).send('Oops, something went wrong')
  }
})

const shutdownCleanly = signal => () => {
  logger.info({ signal }, 'received interrupt, cleaning up')
  if (Settings.shuttingDown) {
    logger.warn({ signal }, 'already shutting down, ignoring interrupt')
    return
  }
  Settings.shuttingDown = true
  // record the time we started shutting down
  Settings.shutDownTime = Date.now()
  setTimeout(() => {
    logger.info({ signal }, 'shutting down')
    process.exit()
  }, Settings.gracefulShutdownDelayInMs)
}

const watchForEvent = eventName => {
  docUpdaterRedisClient.on(eventName, e => {
    console.log(`redis event: ${eventName} ${e}`) // eslint-disable-line no-console
  })
}

const events = ['connect', 'ready', 'error', 'close', 'reconnecting', 'end']
for (const eventName of events) {
  watchForEvent(eventName)
}

const port =
  Settings.internal.documentupdater.port ||
  (Settings.api &&
    Settings.api.documentupdater &&
    Settings.api.documentupdater.port) ||
  3003
const host = Settings.internal.documentupdater.host || '127.0.0.1'

if (!module.parent) {
  // Called directly
  mongodb.mongoClient
    .connect()
    .then(() => {
      app.listen(port, host, function (err) {
        if (err) {
          logger.fatal({ err }, `Cannot bind to ${host}:${port}. Exiting.`)
          process.exit(1)
        }
        logger.info(
          `Document-updater starting up, listening on ${host}:${port}`
        )
        if (Settings.continuousBackgroundFlush) {
          logger.info('Starting continuous background flush')
          DeleteQueueManager.startBackgroundFlush()
        }
      })
    })
    .catch(err => {
      logger.fatal({ err }, 'Cannot connect to mongo. Exiting.')
      process.exit(1)
    })
}

module.exports = app

for (const signal of [
  'SIGINT',
  'SIGHUP',
  'SIGQUIT',
  'SIGUSR1',
  'SIGUSR2',
  'SIGTERM',
  'SIGABRT',
]) {
  process.on(signal, shutdownCleanly(signal))
}

function longerTimeout(req, res, next) {
  res.setTimeout(6 * 60 * 1000)
  next()
}
