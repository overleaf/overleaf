// Metrics must be initialized before importing anything else
require('@overleaf/metrics/initialize')

const CompileController = require('./app/js/CompileController')
const ContentController = require('./app/js/ContentController')
const Settings = require('@overleaf/settings')
const logger = require('@overleaf/logger')
logger.initialize('clsi')
const LoggerSerializers = require('./app/js/LoggerSerializers')
logger.logger.serializers.clsiRequest = LoggerSerializers.clsiRequest

const Metrics = require('@overleaf/metrics')

const smokeTest = require('./test/smoke/js/SmokeTests')
const ContentTypeMapper = require('./app/js/ContentTypeMapper')
const Errors = require('./app/js/Errors')
const { createOutputZip } = require('./app/js/OutputController')

const Path = require('node:path')

Metrics.open_sockets.monitor(true)
Metrics.memory.monitor(logger)
Metrics.leaked_sockets.monitor(logger)

const ProjectPersistenceManager = require('./app/js/ProjectPersistenceManager')
const OutputCacheManager = require('./app/js/OutputCacheManager')
const ContentCacheManager = require('./app/js/ContentCacheManager')

ProjectPersistenceManager.init()
OutputCacheManager.init()

const express = require('express')
const bodyParser = require('body-parser')
const app = express()

Metrics.injectMetricsRoute(app)
app.use(Metrics.http.monitor(logger))

// Compile requests can take longer than the default two
// minutes (including file download time), so bump up the
// timeout a bit.
const TIMEOUT = 10 * 60 * 1000
app.use(function (req, res, next) {
  req.setTimeout(TIMEOUT)
  res.setTimeout(TIMEOUT)
  res.removeHeader('X-Powered-By')
  next()
})

app.param('project_id', function (req, res, next, projectId) {
  if (projectId?.match(/^[a-zA-Z0-9_-]+$/)) {
    next()
  } else {
    next(new Error('invalid project id'))
  }
})

app.param('user_id', function (req, res, next, userId) {
  if (userId?.match(/^[0-9a-f]{24}$/)) {
    next()
  } else {
    next(new Error('invalid user id'))
  }
})

app.param('build_id', function (req, res, next, buildId) {
  if (buildId?.match(OutputCacheManager.BUILD_REGEX)) {
    next()
  } else {
    next(new Error(`invalid build id ${buildId}`))
  }
})

app.param('contentId', function (req, res, next, contentId) {
  if (contentId?.match(OutputCacheManager.CONTENT_REGEX)) {
    next()
  } else {
    next(new Error(`invalid content id ${contentId}`))
  }
})

app.param('hash', function (req, res, next, hash) {
  if (hash?.match(ContentCacheManager.HASH_REGEX)) {
    next()
  } else {
    next(new Error(`invalid hash ${hash}`))
  }
})

app.post(
  '/project/:project_id/compile',
  bodyParser.json({ limit: Settings.compileSizeLimit }),
  CompileController.compile
)
app.post('/project/:project_id/compile/stop', CompileController.stopCompile)
app.delete('/project/:project_id', CompileController.clearCache)

app.get('/project/:project_id/sync/code', CompileController.syncFromCode)
app.get('/project/:project_id/sync/pdf', CompileController.syncFromPdf)
app.get('/project/:project_id/wordcount', CompileController.wordcount)
app.get('/project/:project_id/status', CompileController.status)
app.post('/project/:project_id/status', CompileController.status)

// Per-user containers
app.post(
  '/project/:project_id/user/:user_id/compile',
  bodyParser.json({ limit: Settings.compileSizeLimit }),
  CompileController.compile
)
app.post(
  '/project/:project_id/user/:user_id/compile/stop',
  CompileController.stopCompile
)
app.delete('/project/:project_id/user/:user_id', CompileController.clearCache)

app.get(
  '/project/:project_id/user/:user_id/sync/code',
  CompileController.syncFromCode
)
app.get(
  '/project/:project_id/user/:user_id/sync/pdf',
  CompileController.syncFromPdf
)
app.get(
  '/project/:project_id/user/:user_id/wordcount',
  CompileController.wordcount
)

const ForbidSymlinks = require('./app/js/StaticServerForbidSymlinks')

// create a static server which does not allow access to any symlinks
// avoids possible mismatch of root directory between middleware check
// and serving the files
const staticOutputServer = ForbidSymlinks(
  express.static,
  Settings.path.outputDir,
  {
    setHeaders(res, path, stat) {
      if (Path.basename(path) === 'output.pdf') {
        // Calculate an etag in the same way as nginx
        // https://github.com/tj/send/issues/65
        const etag = (path, stat) =>
          `"${Math.ceil(+stat.mtime / 1000).toString(16)}` +
          '-' +
          Number(stat.size).toString(16) +
          '"'
        res.set('Etag', etag(path, stat))
      }
      res.set('Content-Type', ContentTypeMapper.map(path))
    },
  }
)

// This needs to be before GET /project/:project_id/build/:build_id/output/*
app.get(
  '/project/:project_id/build/:build_id/output/output.zip',
  bodyParser.json(),
  createOutputZip
)

// This needs to be before GET /project/:project_id/user/:user_id/build/:build_id/output/*
app.get(
  '/project/:project_id/user/:user_id/build/:build_id/output/output.zip',
  bodyParser.json(),
  createOutputZip
)

app.get(
  '/project/:project_id/user/:user_id/build/:build_id/output/*',
  function (req, res, next) {
    // for specific build get the path from the OutputCacheManager (e.g. .clsi/buildId)
    req.url =
      `/${req.params.project_id}-${req.params.user_id}/` +
      OutputCacheManager.path(req.params.build_id, `/${req.params[0]}`)
    staticOutputServer(req, res, next)
  }
)

app.get(
  '/project/:projectId/content/:contentId/:hash',
  ContentController.getPdfRange
)
app.get(
  '/project/:projectId/user/:userId/content/:contentId/:hash',
  ContentController.getPdfRange
)

app.get(
  '/project/:project_id/build/:build_id/output/*',
  function (req, res, next) {
    // for specific build get the path from the OutputCacheManager (e.g. .clsi/buildId)
    req.url =
      `/${req.params.project_id}/` +
      OutputCacheManager.path(req.params.build_id, `/${req.params[0]}`)
    staticOutputServer(req, res, next)
  }
)

app.get('/oops', function (req, res, next) {
  logger.error({ err: 'hello' }, 'test error')
  res.send('error\n')
})

app.get('/oops-internal', function (req, res, next) {
  setTimeout(function () {
    throw new Error('Test error')
  }, 1)
})

app.get('/status', (req, res, next) => res.send('CLSI is alive\n'))

Settings.processTooOld = false
if (Settings.processLifespanLimitMs) {
  // Pre-emp instances have a maximum lifespan of 24h after which they will be
  //  shutdown, with a 30s grace period.
  // Spread cycling of VMs by up-to 2.4h _before_ their limit to avoid large
  //  numbers of VMs that are temporarily unavailable (while they reboot).
  Settings.processLifespanLimitMs -=
    Settings.processLifespanLimitMs * (Math.random() / 10)
  logger.info(
    { target: new Date(Date.now() + Settings.processLifespanLimitMs) },
    'Lifespan limited'
  )

  setTimeout(() => {
    logger.info({}, 'shutting down, process is too old')
    Settings.processTooOld = true
  }, Settings.processLifespanLimitMs)
}

function runSmokeTest() {
  if (Settings.processTooOld) return
  const INTERVAL = 30 * 1000
  if (
    smokeTest.lastRunSuccessful() &&
    CompileController.timeSinceLastSuccessfulCompile() < INTERVAL / 2
  ) {
    logger.debug('skipping smoke tests, got recent successful user compile')
    return setTimeout(runSmokeTest, INTERVAL / 2)
  }
  logger.debug('running smoke tests')
  smokeTest.triggerRun(err => {
    if (err) logger.error({ err }, 'smoke tests failed')
    setTimeout(runSmokeTest, INTERVAL)
  })
}
if (Settings.smokeTest) {
  runSmokeTest()
}

app.get('/health_check', function (req, res) {
  if (Settings.processTooOld) {
    return res.status(500).json({ processTooOld: true })
  }
  if (ProjectPersistenceManager.isAnyDiskCriticalLow()) {
    return res.status(500).json({ diskCritical: true })
  }
  smokeTest.sendLastResult(res)
})

app.get('/smoke_test_force', (req, res) => smokeTest.sendNewResult(res))

app.use(function (error, req, res, next) {
  if (error instanceof Errors.NotFoundError) {
    logger.debug({ err: error, url: req.url }, 'not found error')
    res.sendStatus(404)
  } else if (error instanceof Errors.InvalidParameter) {
    res.status(400).send(error.message)
  } else if (error.code === 'EPIPE') {
    // inspect container returns EPIPE when shutting down
    res.sendStatus(503) // send 503 Unavailable response
  } else {
    logger.error({ err: error, url: req.url }, 'server error')
    res.sendStatus(error.statusCode || 500)
  }
})

const net = require('node:net')
const os = require('node:os')

let STATE = 'up'

const loadTcpServer = net.createServer(function (socket) {
  socket.on('error', function (err) {
    if (err.code === 'ECONNRESET') {
      // this always comes up, we don't know why
      return
    }
    logger.err({ err }, 'error with socket on load check')
    socket.destroy()
  })

  if (STATE === 'up' && Settings.internal.load_balancer_agent.report_load) {
    let availableWorkingCpus
    const currentLoad = os.loadavg()[0]

    // staging clis's have 1 cpu core only
    if (os.cpus().length === 1) {
      availableWorkingCpus = 1
    } else {
      availableWorkingCpus = os.cpus().length - 1
    }

    const freeLoad = availableWorkingCpus - currentLoad
    let freeLoadPercentage = Math.round((freeLoad / availableWorkingCpus) * 100)
    if (ProjectPersistenceManager.isAnyDiskCriticalLow()) {
      freeLoadPercentage = 0
    }
    if (ProjectPersistenceManager.isAnyDiskLow()) {
      freeLoadPercentage = freeLoadPercentage / 2
    }

    if (
      Settings.internal.load_balancer_agent.allow_maintenance &&
      freeLoadPercentage <= 0
    ) {
      // When its 0 the server is set to drain implicitly.
      // Drain will move new projects to different servers.
      // Drain will keep existing projects assigned to the same server.
      // Maint will more existing and new projects to different servers.
      socket.write(`maint, 0%\n`, 'ASCII')
    } else {
      // Ready will cancel the maint state.
      socket.write(`up, ready, ${Math.max(freeLoadPercentage, 1)}%\n`, 'ASCII')
      if (freeLoadPercentage <= 0) {
        // This metric records how often we would have gone into maintenance mode.
        Metrics.inc('clsi-prevented-maint')
      }
    }
    socket.end()
  } else {
    socket.write(`${STATE}\n`, 'ASCII')
    socket.end()
  }
})

const loadHttpServer = express()

loadHttpServer.post('/state/up', function (req, res, next) {
  STATE = 'up'
  logger.debug('getting message to set server to down')
  res.sendStatus(204)
})

loadHttpServer.post('/state/down', function (req, res, next) {
  STATE = 'down'
  logger.debug('getting message to set server to down')
  res.sendStatus(204)
})

loadHttpServer.post('/state/maint', function (req, res, next) {
  STATE = 'maint'
  logger.debug('getting message to set server to maint')
  res.sendStatus(204)
})

const port = Settings.internal.clsi.port
const host = Settings.internal.clsi.host

const loadTcpPort = Settings.internal.load_balancer_agent.load_port
const loadHttpPort = Settings.internal.load_balancer_agent.local_port

if (!module.parent) {
  // Called directly

  // handle uncaught exceptions when running in production
  if (Settings.catchErrors) {
    process.removeAllListeners('uncaughtException')
    process.on('uncaughtException', error =>
      logger.error({ err: error }, 'uncaughtException')
    )
  }

  app.listen(port, host, error => {
    if (error) {
      logger.fatal({ error }, `Error starting CLSI on ${host}:${port}`)
    } else {
      logger.debug(`CLSI starting up, listening on ${host}:${port}`)
    }
  })

  loadTcpServer.listen(loadTcpPort, host, function (error) {
    if (error != null) {
      throw error
    }
    logger.debug(`Load tcp agent listening on load port ${loadTcpPort}`)
  })

  loadHttpServer.listen(loadHttpPort, host, function (error) {
    if (error != null) {
      throw error
    }
    logger.debug(`Load http agent listening on load port ${loadHttpPort}`)
  })
}

module.exports = app
