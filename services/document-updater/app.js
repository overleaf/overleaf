const Metrics = require('@overleaf/metrics')
Metrics.initialize('doc-updater')

const express = require('express')
const Settings = require('@overleaf/settings')
const logger = require('logger-sharelatex')
logger.initialize('document-updater')

logger.logger.addSerializers(require('./app/js/LoggerSerializers'))

if (Settings.sentry != null && Settings.sentry.dsn != null) {
  logger.initializeErrorReporting(Settings.sentry.dsn)
}

const RedisManager = require('./app/js/RedisManager')
const DispatchManager = require('./app/js/DispatchManager')
const DeleteQueueManager = require('./app/js/DeleteQueueManager')
const Errors = require('./app/js/Errors')
const HttpController = require('./app/js/HttpController')
const mongodb = require('./app/js/mongodb')
const async = require('async')

const Path = require('path')
const bodyParser = require('body-parser')

Metrics.mongodb.monitor(
  Path.resolve(__dirname, '/node_modules/mongodb'),
  logger
)
Metrics.event_loop.monitor(logger, 100)

const app = express()
app.use(Metrics.http.monitor(logger))
app.use(bodyParser.json({ limit: Settings.maxJsonRequestSize }))
Metrics.injectMetricsRoute(app)

DispatchManager.createAndStartDispatchers(Settings.dispatcherCount)

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

app.get('/project/:project_id/doc/:doc_id', HttpController.getDoc)
// temporarily keep the GET method for backwards compatibility
app.get('/project/:project_id/doc', HttpController.getProjectDocsAndFlushIfOld)
// will migrate to the POST method of get_and_flush_if_old instead
app.post(
  '/project/:project_id/get_and_flush_if_old',
  HttpController.getProjectDocsAndFlushIfOld
)
app.post('/project/:project_id/clearState', HttpController.clearProjectState)
app.post('/project/:project_id/doc/:doc_id', HttpController.setDoc)
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
app.delete(
  '/project/:project_id/doc/:doc_id/comment/:comment_id',
  HttpController.deleteComment
)

app.get('/flush_all_projects', HttpController.flushAllProjects)
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

app.use((error, req, res, next) => {
  if (error instanceof Errors.NotFoundError) {
    return res.sendStatus(404)
  } else if (error instanceof Errors.OpRangeNotAvailableError) {
    return res.sendStatus(422) // Unprocessable Entity
  } else if (error.statusCode === 413) {
    return res.status(413).send('request entity too large')
  } else {
    logger.error({ err: error, req }, 'request errored')
    return res.status(500).send('Oops, something went wrong')
  }
})

const shutdownCleanly = signal => () => {
  logger.log({ signal }, 'received interrupt, cleaning up')
  Settings.shuttingDown = true
  setTimeout(() => {
    logger.log({ signal }, 'shutting down')
    process.exit()
  }, 10000)
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
const host = Settings.internal.documentupdater.host || 'localhost'

if (!module.parent) {
  // Called directly
  mongodb
    .waitForDb()
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
