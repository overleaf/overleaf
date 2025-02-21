// Metrics must be initialized before importing anything else
require('@overleaf/metrics/initialize')

const Metrics = require('@overleaf/metrics')
const Settings = require('@overleaf/settings')
const async = require('async')

const logger = require('@overleaf/logger')
logger.initialize('real-time')
Metrics.event_loop.monitor(logger)
Metrics.open_sockets.monitor()

const express = require('express')
const session = require('express-session')
const redis = require('@overleaf/redis-wrapper')

const sessionRedisClient = redis.createClient(Settings.redis.websessions)

const RedisStore = require('connect-redis')(session)
const SessionSockets = require('./app/js/SessionSockets')
const CookieParser = require('cookie-parser')

const DrainManager = require('./app/js/DrainManager')
const HealthCheckManager = require('./app/js/HealthCheckManager')
const DeploymentManager = require('./app/js/DeploymentManager')

const Path = require('node:path')

// NOTE: debug is invoked for every blob that is put on the wire
const socketIoLogger = {
  error(...message) {
    logger.debug({ fromSocketIo: true, originalLevel: 'error' }, ...message)
  },
  warn(...message) {
    logger.debug({ fromSocketIo: true, originalLevel: 'warn' }, ...message)
  },
  info() {},
  debug() {},
  log() {},
}

// monitor status file to take dark deployments out of the load-balancer
DeploymentManager.initialise()

// Set up socket.io server
const app = express()

const server = require('node:http').createServer(app)
server.keepAliveTimeout = Settings.keepAliveTimeoutMs
const io = require('socket.io').listen(server, {
  logger: socketIoLogger,
})

// Bind to sessions
const sessionStore = new RedisStore({ client: sessionRedisClient })

if (!Settings.security.sessionSecret) {
  throw new Error('No SESSION_SECRET provided.')
}

const sessionSecrets = [
  Settings.security.sessionSecret,
  Settings.security.sessionSecretUpcoming,
  Settings.security.sessionSecretFallback,
].filter(Boolean)
const cookieParser = CookieParser(sessionSecrets)

const sessionSockets = new SessionSockets(
  io,
  sessionStore,
  cookieParser,
  Settings.cookieName
)

Metrics.injectMetricsRoute(app)

io.configure(function () {
  // Don't use socket.io to serve client
  io.disable('browser client')

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
    'jsonp-polling',
  ])
})

// Serve socket.io.js client file from imported dist folder
// The express sendFile method correctly handles conditional
// requests using the last-modified time and etag (which is
// a combination of mtime and size)
const socketIOClientFolder = require('socket.io-client').dist
app.get('/socket.io/socket.io.js', function (req, res) {
  res.sendFile(Path.join(socketIOClientFolder, 'socket.io.min.js'))
})

// a 200 response on '/' is required for load balancer health checks
// these operate separately from kubernetes readiness checks
app.get('/', function (req, res) {
  if (Settings.shutDownInProgress || DeploymentManager.deploymentIsClosed()) {
    res.sendStatus(503) // Service unavailable
  } else {
    res.send('real-time is open')
  }
})

app.get('/status', function (req, res) {
  if (Settings.shutDownInProgress) {
    res.sendStatus(503) // Service unavailable
  } else {
    res.send('real-time is alive')
  }
})

app.get('/debug/events', function (req, res) {
  Settings.debugEvents = parseInt(req.query.count, 10) || 20
  logger.info({ count: Settings.debugEvents }, 'starting debug mode')
  res.send(`debug mode will log next ${Settings.debugEvents} events`)
})

const rclient = require('@overleaf/redis-wrapper').createClient(
  Settings.redis.realtime
)

function healthCheck(req, res) {
  rclient.healthCheck(function (error) {
    if (error) {
      logger.err({ err: error }, 'failed redis health check')
      res.sendStatus(500)
    } else if (HealthCheckManager.isFailing()) {
      const status = HealthCheckManager.status()
      logger.err({ pubSubErrors: status }, 'failed pubsub health check')
      res.sendStatus(500)
    } else {
      res.sendStatus(200)
    }
  })
}
app.get(
  '/health_check',
  (req, res, next) => {
    if (Settings.shutDownComplete) {
      return res.sendStatus(503)
    }
    next()
  },
  healthCheck
)

app.get('/health_check/redis', healthCheck)

// log http requests for routes defined from this point onwards
app.use(Metrics.http.monitor(logger))

const Router = require('./app/js/Router')
Router.configure(app, io, sessionSockets)

const WebsocketLoadBalancer = require('./app/js/WebsocketLoadBalancer')
WebsocketLoadBalancer.listenForEditorEvents(io)

const DocumentUpdaterController = require('./app/js/DocumentUpdaterController')
DocumentUpdaterController.listenForUpdatesFromDocumentUpdater(io)

const { port } = Settings.internal.realTime
const { host } = Settings.internal.realTime

server.listen(port, host, function (error) {
  if (error) {
    throw error
  }
  logger.info(`realtime starting up, listening on ${host}:${port}`)
})

// Stop huge stack traces in logs from all the socket.io parsing steps.
Error.stackTraceLimit = 10

function shutdownAfterAllClientsHaveDisconnected() {
  const connectedClients = io.sockets.clients().length
  if (connectedClients === 0) {
    logger.info({}, 'no clients connected, exiting')
    process.exit()
  } else {
    logger.info(
      { connectedClients },
      'clients still connected, not shutting down yet'
    )
    setTimeout(() => shutdownAfterAllClientsHaveDisconnected(), 5_000)
  }
}

function drainAndShutdown(signal) {
  if (Settings.shutDownInProgress) {
    logger.info({ signal }, 'shutdown already in progress, ignoring signal')
  } else {
    Settings.shutDownInProgress = true
    const { statusCheckInterval } = Settings
    if (statusCheckInterval) {
      logger.info(
        { signal },
        `received interrupt, delay drain by ${statusCheckInterval}ms`
      )
    }
    setTimeout(function () {
      logger.info(
        { signal },
        `received interrupt, starting drain over ${shutdownDrainTimeWindow} mins`
      )
      DrainManager.startDrainTimeWindow(io, shutdownDrainTimeWindow, () => {
        shutdownAfterAllClientsHaveDisconnected()
        setTimeout(() => {
          const staleClients = io.sockets.clients()
          if (staleClients.length !== 0) {
            logger.info(
              { staleClients: staleClients.map(client => client.id) },
              'forcefully disconnecting stale clients'
            )
            staleClients.forEach(client => {
              client.disconnect()
            })
          }
          // Mark the node as unhealthy.
          Settings.shutDownComplete = true
        }, Settings.gracefulReconnectTimeoutMs)
      })
    }, statusCheckInterval)
  }
}

Settings.shutDownInProgress = false
const shutdownDrainTimeWindow = parseInt(Settings.shutdownDrainTimeWindow, 10)
if (Settings.shutdownDrainTimeWindow) {
  logger.info({ shutdownDrainTimeWindow }, 'shutdownDrainTimeWindow enabled')
  for (const signal of [
    'SIGINT',
    'SIGHUP',
    'SIGQUIT',
    'SIGUSR1',
    'SIGUSR2',
    'SIGTERM',
    'SIGABRT',
  ]) {
    process.on(signal, drainAndShutdown)
  } // signal is passed as argument to event handler

  // global exception handler
  if (Settings.errors && Settings.errors.catchUncaughtErrors) {
    process.removeAllListeners('uncaughtException')
    process.on('uncaughtException', function (error) {
      if (
        [
          'ETIMEDOUT',
          'EHOSTUNREACH',
          'EPIPE',
          'ECONNRESET',
          'ERR_STREAM_WRITE_AFTER_END',
        ].includes(error.code) ||
        // socket.io error handler sending on polling connection again.
        (error.code === 'ERR_HTTP_HEADERS_SENT' &&
          error.stack &&
          error.stack.includes('Transport.error'))
      ) {
        Metrics.inc('disconnected_write', 1, { status: error.code })
        return logger.warn(
          { err: error },
          'attempted to write to disconnected client'
        )
      }
      logger.error({ err: error }, 'uncaught exception')
      if (Settings.errors && Settings.errors.shutdownOnUncaughtError) {
        drainAndShutdown('SIGABRT')
      }
    })
  }
}

if (Settings.continualPubsubTraffic) {
  logger.debug('continualPubsubTraffic enabled')

  const pubsubClient = redis.createClient(Settings.redis.pubsub)
  const clusterClient = redis.createClient(Settings.redis.websessions)

  const publishJob = function (channel, callback) {
    const checker = new HealthCheckManager(channel)
    logger.debug({ channel }, 'sending pub to keep connection alive')
    const json = JSON.stringify({
      health_check: true,
      key: checker.id,
      date: new Date().toString(),
    })
    Metrics.summary(`redis.publish.${channel}`, json.length)
    pubsubClient.publish(channel, json, function (err) {
      if (err) {
        logger.err({ err, channel }, 'error publishing pubsub traffic to redis')
      }
      const blob = JSON.stringify({ keep: 'alive' })
      Metrics.summary('redis.publish.cluster-continual-traffic', blob.length)
      clusterClient.publish('cluster-continual-traffic', blob, callback)
    })
  }

  const runPubSubTraffic = () =>
    async.map(['applied-ops', 'editor-events'], publishJob, () =>
      setTimeout(runPubSubTraffic, 1000 * 20)
    )

  runPubSubTraffic()
}
