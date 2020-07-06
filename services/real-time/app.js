/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const Metrics = require('metrics-sharelatex')
const Settings = require('settings-sharelatex')
Metrics.initialize(Settings.appName || 'real-time')
const async = require('async')

const logger = require('logger-sharelatex')
logger.initialize('real-time')
Metrics.event_loop.monitor(logger)

const express = require('express')
const session = require('express-session')
const redis = require('redis-sharelatex')
if ((Settings.sentry != null ? Settings.sentry.dsn : undefined) != null) {
  logger.initializeErrorReporting(Settings.sentry.dsn)
}

const sessionRedisClient = redis.createClient(Settings.redis.websessions)

const RedisStore = require('connect-redis')(session)
const SessionSockets = require('./app/js/SessionSockets')
const CookieParser = require('cookie-parser')

const DrainManager = require('./app/js/DrainManager')
const HealthCheckManager = require('./app/js/HealthCheckManager')

// work around frame handler bug in socket.io v0.9.16
require('./socket.io.patch.js')
// Set up socket.io server
const app = express()

const server = require('http').createServer(app)
const io = require('socket.io').listen(server)

// Bind to sessions
const sessionStore = new RedisStore({ client: sessionRedisClient })
const cookieParser = CookieParser(Settings.security.sessionSecret)

const sessionSockets = new SessionSockets(
  io,
  sessionStore,
  cookieParser,
  Settings.cookieName
)

Metrics.injectMetricsRoute(app)
app.use(Metrics.http.monitor(logger))

io.configure(function () {
  io.enable('browser client minification')
  io.enable('browser client etag')

  // Fix for Safari 5 error of "Error during WebSocket handshake: location mismatch"
  // See http://answers.dotcloud.com/question/578/problem-with-websocket-over-ssl-in-safari-with
  io.set('match origin protocol', true)

  // gzip uses a Node 0.8.x method of calling the gzip program which
  // doesn't work with 0.6.x
  // io.enable('browser client gzip')
  io.set('transports', [
    'websocket',
    'flashsocket',
    'htmlfile',
    'xhr-polling',
    'jsonp-polling'
  ])
  return io.set('log level', 1)
})

app.get('/', (req, res, next) => res.send('real-time-sharelatex is alive'))

app.get('/status', function (req, res, next) {
  if (Settings.shutDownInProgress) {
    return res.send(503) // Service unavailable
  } else {
    return res.send('real-time-sharelatex is alive')
  }
})

app.get('/debug/events', function (req, res, next) {
  Settings.debugEvents =
    parseInt(req.query != null ? req.query.count : undefined, 10) || 20
  logger.log({ count: Settings.debugEvents }, 'starting debug mode')
  return res.send(`debug mode will log next ${Settings.debugEvents} events`)
})

const rclient = require('redis-sharelatex').createClient(
  Settings.redis.realtime
)

const healthCheck = (req, res, next) =>
  rclient.healthCheck(function (error) {
    if (error != null) {
      logger.err({ err: error }, 'failed redis health check')
      return res.sendStatus(500)
    } else if (HealthCheckManager.isFailing()) {
      const status = HealthCheckManager.status()
      logger.err({ pubSubErrors: status }, 'failed pubsub health check')
      return res.sendStatus(500)
    } else {
      return res.sendStatus(200)
    }
  })

app.get('/health_check', healthCheck)

app.get('/health_check/redis', healthCheck)

const Router = require('./app/js/Router')
Router.configure(app, io, sessionSockets)

const WebsocketLoadBalancer = require('./app/js/WebsocketLoadBalancer')
WebsocketLoadBalancer.listenForEditorEvents(io)

const DocumentUpdaterController = require('./app/js/DocumentUpdaterController')
DocumentUpdaterController.listenForUpdatesFromDocumentUpdater(io)

const { port } = Settings.internal.realTime
const { host } = Settings.internal.realTime

server.listen(port, host, function (error) {
  if (error != null) {
    throw error
  }
  return logger.info(`realtime starting up, listening on ${host}:${port}`)
})

// Stop huge stack traces in logs from all the socket.io parsing steps.
Error.stackTraceLimit = 10

var shutdownCleanly = function (signal) {
  const connectedClients = __guard__(io.sockets.clients(), (x) => x.length)
  if (connectedClients === 0) {
    logger.warn('no clients connected, exiting')
    return process.exit()
  } else {
    logger.warn(
      { connectedClients },
      'clients still connected, not shutting down yet'
    )
    return setTimeout(() => shutdownCleanly(signal), 30 * 1000)
  }
}

const drainAndShutdown = function (signal) {
  if (Settings.shutDownInProgress) {
    logger.warn({ signal }, 'shutdown already in progress, ignoring signal')
  } else {
    Settings.shutDownInProgress = true
    const { statusCheckInterval } = Settings
    if (statusCheckInterval) {
      logger.warn(
        { signal },
        `received interrupt, delay drain by ${statusCheckInterval}ms`
      )
    }
    return setTimeout(function () {
      logger.warn(
        { signal },
        `received interrupt, starting drain over ${shutdownDrainTimeWindow} mins`
      )
      DrainManager.startDrainTimeWindow(io, shutdownDrainTimeWindow)
      return shutdownCleanly(signal)
    }, statusCheckInterval)
  }
}

Settings.shutDownInProgress = false
if (Settings.shutdownDrainTimeWindow != null) {
  var shutdownDrainTimeWindow = parseInt(Settings.shutdownDrainTimeWindow, 10)
  logger.log({ shutdownDrainTimeWindow }, 'shutdownDrainTimeWindow enabled')
  for (const signal of [
    'SIGINT',
    'SIGHUP',
    'SIGQUIT',
    'SIGUSR1',
    'SIGUSR2',
    'SIGTERM',
    'SIGABRT'
  ]) {
    process.on(signal, drainAndShutdown)
  } // signal is passed as argument to event handler

  // global exception handler
  if (
    Settings.errors != null ? Settings.errors.catchUncaughtErrors : undefined
  ) {
    process.removeAllListeners('uncaughtException')
    process.on('uncaughtException', function (error) {
      if (['EPIPE', 'ECONNRESET'].includes(error.code)) {
        Metrics.inc('disconnected_write', 1, { status: error.code })
        return logger.warn(
          { err: error },
          'attempted to write to disconnected client'
        )
      }
      logger.error({ err: error }, 'uncaught exception')
      if (
        Settings.errors != null
          ? Settings.errors.shutdownOnUncaughtError
          : undefined
      ) {
        return drainAndShutdown('SIGABRT')
      }
    })
  }
}

if (Settings.continualPubsubTraffic) {
  logger.warn('continualPubsubTraffic enabled')

  const pubsubClient = redis.createClient(Settings.redis.pubsub)
  const clusterClient = redis.createClient(Settings.redis.websessions)

  const publishJob = function (channel, callback) {
    const checker = new HealthCheckManager(channel)
    logger.debug({ channel }, 'sending pub to keep connection alive')
    const json = JSON.stringify({
      health_check: true,
      key: checker.id,
      date: new Date().toString()
    })
    Metrics.summary(`redis.publish.${channel}`, json.length)
    return pubsubClient.publish(channel, json, function (err) {
      if (err != null) {
        logger.err({ err, channel }, 'error publishing pubsub traffic to redis')
      }
      const blob = JSON.stringify({ keep: 'alive' })
      Metrics.summary('redis.publish.cluster-continual-traffic', blob.length)
      return clusterClient.publish('cluster-continual-traffic', blob, callback)
    })
  }

  var runPubSubTraffic = () =>
    async.map(['applied-ops', 'editor-events'], publishJob, () =>
      setTimeout(runPubSubTraffic, 1000 * 20)
    )

  runPubSubTraffic()
}

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
