const metrics = require('@overleaf/metrics')
const logger = require('@overleaf/logger')
const settings = require('@overleaf/settings')
const WebsocketController = require('./WebsocketController')
const HttpController = require('./HttpController')
const HttpApiController = require('./HttpApiController')
const WebsocketAddressManager = require('./WebsocketAddressManager')
const bodyParser = require('body-parser')
const base64id = require('base64id')
const { UnexpectedArgumentsError } = require('./Errors')
const Joi = require('joi')

const HOSTNAME = require('node:os').hostname()
const SERVER_PING_INTERVAL = 15000
const SERVER_PING_LATENCY_THRESHOLD = 5000

const JOI_OBJECT_ID = Joi.string()
  .required()
  .regex(/^[0-9a-f]{24}$/)
  .message('invalid id')

let Router
module.exports = Router = {
  _handleError(callback, error, client, method, attrs) {
    attrs = attrs || {}
    for (const key of ['project_id', 'user_id']) {
      attrs[key] = attrs[key] || client.ol_context[key]
    }
    attrs.client_id = client.id
    attrs.err = error
    attrs.method = method
    if (Joi.isError(error)) {
      logger.info(attrs, 'validation error')
      let message = 'invalid'
      try {
        message = error.details[0].message
      } catch (e) {
        // ignore unexpected errors
        logger.warn({ error, e }, 'unexpected validation error')
      }
      const serializedError = { message }
      metrics.inc('validation-error', 1, {
        status: method,
      })
      callback(serializedError)
    } else if (error.name === 'CodedError') {
      logger.warn(attrs, error.message)
      const serializedError = { message: error.message, code: error.info.code }
      callback(serializedError)
    } else if (error.message === 'unexpected arguments') {
      // the payload might be very large; put it on level debug
      logger.debug(attrs, 'unexpected arguments')
      metrics.inc('unexpected-arguments', 1, { status: method })
      const serializedError = { message: error.message }
      callback(serializedError)
    } else if (error.message === 'no project_id found on client') {
      logger.debug(attrs, error.message)
      const serializedError = { message: error.message }
      callback(serializedError)
    } else if (
      [
        'not authorized',
        'joinLeaveEpoch mismatch',
        'doc updater could not load requested ops',
        'no project_id found on client',
        'cannot join multiple projects',
      ].includes(error.message)
    ) {
      logger.warn(attrs, error.message)
      const serializedError = { message: error.message }
      callback(serializedError)
    } else {
      logger.error(attrs, `server side error in ${method}`)
      // Don't return raw error to prevent leaking server side info
      const serializedError = {
        message: 'Something went wrong in real-time service',
      }
      callback(serializedError)
    }
    if (attrs.disconnect) {
      setTimeout(function () {
        client.disconnect()
      }, 100)
    }
  },

  _handleInvalidArguments(client, method, args) {
    const error = new UnexpectedArgumentsError()
    let callback = args[args.length - 1]
    if (typeof callback !== 'function') {
      callback = function () {}
    }
    const attrs = { arguments: args }
    Router._handleError(callback, error, client, method, attrs)
  },

  configure(app, io, session) {
    app.set('io', io)

    if (settings.behindProxy) {
      app.set('trust proxy', settings.trustedProxyIps)
    }
    const websocketAddressManager = new WebsocketAddressManager(
      settings.behindProxy,
      settings.trustedProxyIps
    )

    app.get('/clients', HttpController.getConnectedClients)
    app.get('/clients/:client_id', HttpController.getConnectedClient)

    app.post(
      '/project/:project_id/message/:message',
      bodyParser.json({ limit: '5mb' }),
      HttpApiController.sendMessage
    )

    app.post('/drain', HttpApiController.startDrain)
    app.post(
      '/client/:client_id/disconnect',
      HttpApiController.disconnectClient
    )

    session.on('connection', function (error, client, session) {
      // init client context, we may access it in Router._handleError before
      //  setting any values
      client.ol_context = {}
      // bail out from joinDoc when a parallel joinDoc or leaveDoc is running
      client.joinLeaveEpoch = 0

      if (client) {
        client.on('error', function (err) {
          logger.err(
            { clientErr: err, publicId: client.publicId, clientId: client.id },
            'socket.io client error'
          )
          if (client.connected) {
            client.emit('reconnectGracefully')
            client.disconnect()
          }
        })
      }

      if (settings.shutDownInProgress) {
        client.emit('connectionRejected', { message: 'retry' })
        client.disconnect()
        return
      }

      if (
        client &&
        error &&
        error.message.match(/could not look up session by key/)
      ) {
        logger.warn(
          { err: error, client: !!client, session: !!session },
          'invalid session'
        )
        // tell the client to reauthenticate if it has an invalid session key
        client.emit('connectionRejected', { message: 'invalid session' })
        client.disconnect()
        return
      }

      if (error) {
        logger.err(
          { err: error, client: !!client, session: !!session },
          'error when client connected'
        )
        if (client) {
          client.emit('connectionRejected', { message: 'error' })
        }
        if (client) {
          client.disconnect()
        }
        return
      }
      const useServerPing =
        !!client.handshake?.query?.esh && !!client.handshake?.query?.ssp
      const isDebugging = !!client.handshake?.query?.debugging
      const projectId = client.handshake?.query?.projectId

      if (isDebugging) {
        client.connectedAt = Date.now()
        client.isDebugging = true
      }

      if (!isDebugging) {
        try {
          Joi.assert(projectId, JOI_OBJECT_ID)
        } catch (error) {
          metrics.inc('socket-io.connection', 1, {
            status: client.transport,
            method: projectId ? 'bad-project-id' : 'missing-project-id',
          })
          client.emit('connectionRejected', {
            message: 'missing/bad ?projectId=... query flag on handshake',
          })
          client.disconnect()
          return
        }
      }

      // The client.id is security sensitive. Generate a publicId for sending to other clients.
      client.publicId = 'P.' + base64id.generateId()

      client.remoteIp = websocketAddressManager.getRemoteIp(client.handshake)
      const headers = client.handshake && client.handshake.headers
      client.userAgent = headers && headers['user-agent']

      metrics.inc('socket-io.connection', 1, {
        status: client.transport,
        method: 'auto-join-project',
      })
      metrics.gauge('socket-io.clients', io.sockets.clients().length)

      const info = {
        session,
        publicId: client.publicId,
        clientId: client.id,
        isDebugging,
      }
      if (isDebugging) {
        logger.info(info, 'client connected')
      } else {
        logger.debug(info, 'client connected')
      }

      let user
      if (session && session.passport && session.passport.user) {
        ;({ user } = session.passport)
      } else if (session && session.user) {
        ;({ user } = session)
      } else {
        const anonymousAccessToken = session?.anonTokenAccess?.[projectId]
        user = { _id: 'anonymous-user', anonymousAccessToken }
      }

      const connectionDetails = {
        userId: user._id,
        projectId,
        remoteIp: client.remoteIp,
        publicId: client.publicId,
        clientId: client.id,
      }

      let pingTimestamp
      let pingId = -1
      let pongId = -1
      const pingTimer = useServerPing
        ? setInterval(function () {
            if (pongId !== pingId) {
              logger.warn(
                {
                  ...connectionDetails,
                  pingId,
                  pongId,
                  lastPingTimestamp: pingTimestamp,
                },
                'no client response to last ping'
              )
            }
            pingTimestamp = Date.now()
            client.emit('serverPing', ++pingId, pingTimestamp)
          }, SERVER_PING_INTERVAL)
        : null
      client.on('clientPong', function (receivedPingId, sentTimestamp) {
        pongId = receivedPingId
        const receivedTimestamp = Date.now()
        if (receivedPingId !== pingId) {
          logger.warn(
            {
              ...connectionDetails,
              receivedPingId,
              pingId,
              sentTimestamp,
              receivedTimestamp,
              latency: receivedTimestamp - sentTimestamp,
              lastPingTimestamp: pingTimestamp,
            },
            'received pong with wrong counter'
          )
        } else if (
          receivedTimestamp - sentTimestamp >
          SERVER_PING_LATENCY_THRESHOLD
        ) {
          logger.warn(
            {
              ...connectionDetails,
              receivedPingId,
              pingId,
              sentTimestamp,
              receivedTimestamp,
              latency: receivedTimestamp - sentTimestamp,
              lastPingTimestamp: pingTimestamp,
            },
            'received pong with high latency'
          )
        }
      })

      if (settings.exposeHostname) {
        client.on('debug.getHostname', function (callback) {
          if (typeof callback !== 'function') {
            return Router._handleInvalidArguments(
              client,
              'debug.getHostname',
              arguments
            )
          }
          callback(HOSTNAME)
        })
      }
      client.on('debug', (data, callback) => {
        if (typeof callback !== 'function') {
          return Router._handleInvalidArguments(client, 'debug', arguments)
        }

        logger.info(
          { publicId: client.publicId, clientId: client.id },
          'received debug message'
        )

        const response = {
          serverTime: Date.now(),
          data,
          client: {
            publicId: client.publicId,
            remoteIp: client.remoteIp,
            userAgent: client.userAgent,
            connected: !client.disconnected,
            connectedAt: client.connectedAt,
          },
          server: {
            hostname: settings.exposeHostname ? HOSTNAME : undefined,
          },
        }

        callback(response)
      })
      const joinProject = function (callback) {
        WebsocketController.joinProject(
          client,
          user,
          projectId,
          function (err, ...args) {
            if (err) {
              Router._handleError(callback, err, client, 'joinProject', {
                project_id: projectId,
                user_id: user._id,
              })
            } else {
              callback(null, ...args)
            }
          }
        )
      }

      client.on('disconnect', function () {
        metrics.inc('socket-io.disconnect', 1, { status: client.transport })
        metrics.gauge('socket-io.clients', io.sockets.clients().length)

        if (client.isDebugging) {
          const duration = Date.now() - client.connectedAt
          metrics.timing('socket-io.debugging.duration', duration)
          logger.info(
            { duration, publicId: client.publicId, clientId: client.id },
            'debug client disconnected'
          )
        } else {
          clearInterval(pingTimer)
        }

        WebsocketController.leaveProject(io, client, function (err) {
          if (err) {
            Router._handleError(function () {}, err, client, 'leaveProject')
          }
        })
      })

      // Variadic. The possible arguments:
      // doc_id, callback
      // doc_id, fromVersion, callback
      // doc_id, options, callback
      // doc_id, fromVersion, options, callback
      client.on('joinDoc', function (docId, fromVersion, options, callback) {
        if (typeof fromVersion === 'function' && !options) {
          callback = fromVersion
          fromVersion = -1
          options = {}
        } else if (
          typeof fromVersion === 'number' &&
          typeof options === 'function'
        ) {
          callback = options
          options = {}
        } else if (
          typeof fromVersion === 'object' &&
          typeof options === 'function'
        ) {
          callback = options
          options = fromVersion
          fromVersion = -1
        } else if (
          typeof fromVersion === 'number' &&
          typeof options === 'object' &&
          typeof callback === 'function'
        ) {
          // Called with 4 args, things are as expected
        } else {
          return Router._handleInvalidArguments(client, 'joinDoc', arguments)
        }
        try {
          Joi.assert(
            { doc_id: docId, fromVersion, options },
            Joi.object({
              doc_id: JOI_OBJECT_ID,
              fromVersion: Joi.number().integer(),
              options: Joi.object().required(),
            })
          )
        } catch (error) {
          return Router._handleError(callback, error, client, 'joinDoc', {
            disconnect: 1,
          })
        }
        WebsocketController.joinDoc(
          client,
          docId,
          fromVersion,
          options,
          function (err, ...args) {
            if (err) {
              Router._handleError(callback, err, client, 'joinDoc', {
                doc_id: docId,
                fromVersion,
              })
            } else {
              callback(null, ...args)
            }
          }
        )
      })

      client.on('leaveDoc', function (docId, callback) {
        if (typeof callback !== 'function') {
          return Router._handleInvalidArguments(client, 'leaveDoc', arguments)
        }
        try {
          Joi.assert(docId, JOI_OBJECT_ID)
        } catch (error) {
          return Router._handleError(callback, error, client, 'joinDoc', {
            disconnect: 1,
          })
        }
        WebsocketController.leaveDoc(client, docId, function (err, ...args) {
          if (err) {
            Router._handleError(callback, err, client, 'leaveDoc', {
              doc_id: docId,
            })
          } else {
            callback(null, ...args)
          }
        })
      })

      client.on('clientTracking.getConnectedUsers', function (callback) {
        if (typeof callback !== 'function') {
          return Router._handleInvalidArguments(
            client,
            'clientTracking.getConnectedUsers',
            arguments
          )
        }

        WebsocketController.getConnectedUsers(client, function (err, users) {
          if (err) {
            Router._handleError(
              callback,
              err,
              client,
              'clientTracking.getConnectedUsers'
            )
          } else {
            callback(null, users)
          }
        })
      })

      client.on(
        'clientTracking.updatePosition',
        function (cursorData, callback) {
          if (!callback) {
            callback = function () {
              // NOTE: The frontend does not pass any callback to socket.io.
              // Any error is already logged via Router._handleError.
            }
          }
          if (typeof callback !== 'function') {
            return Router._handleInvalidArguments(
              client,
              'clientTracking.updatePosition',
              arguments
            )
          }

          WebsocketController.updateClientPosition(
            client,
            cursorData,
            function (err) {
              if (err) {
                Router._handleError(
                  callback,
                  err,
                  client,
                  'clientTracking.updatePosition'
                )
              } else {
                callback()
              }
            }
          )
        }
      )

      client.on('applyOtUpdate', function (docId, update, callback) {
        if (typeof callback !== 'function') {
          return Router._handleInvalidArguments(
            client,
            'applyOtUpdate',
            arguments
          )
        }
        try {
          Joi.assert(
            { doc_id: docId, update },
            Joi.object({
              doc_id: JOI_OBJECT_ID,
              update: Joi.object().required(),
            })
          )
        } catch (error) {
          return Router._handleError(callback, error, client, 'applyOtUpdate', {
            disconnect: 1,
          })
        }
        WebsocketController.applyOtUpdate(
          client,
          docId,
          update,
          function (err) {
            if (err) {
              Router._handleError(callback, err, client, 'applyOtUpdate', {
                doc_id: docId,
                update,
              })
            } else {
              callback()
            }
          }
        )
      })

      if (!isDebugging) {
        joinProject((err, project, permissionsLevel, protocolVersion) => {
          if (err) {
            client.emit('connectionRejected', err)
            client.disconnect()
            return
          }
          client.emit('joinProjectResponse', {
            publicId: client.publicId,
            project,
            permissionsLevel,
            protocolVersion,
          })
        })
      }
    })
  },
}
