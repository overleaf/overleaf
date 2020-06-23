/* eslint-disable
    camelcase,
    handle-callback-err,
    standard/no-callback-literal,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let Router
const metrics = require('metrics-sharelatex')
const logger = require('logger-sharelatex')
const settings = require('settings-sharelatex')
const WebsocketController = require('./WebsocketController')
const HttpController = require('./HttpController')
const HttpApiController = require('./HttpApiController')
const bodyParser = require('body-parser')
const base64id = require('base64id')

const basicAuth = require('basic-auth-connect')
const httpAuth = basicAuth(function (user, pass) {
  const isValid =
    user === settings.internal.realTime.user &&
    pass === settings.internal.realTime.pass
  if (!isValid) {
    logger.err({ user, pass }, 'invalid login details')
  }
  return isValid
})

module.exports = Router = {
  _handleError(callback, error, client, method, attrs) {
    if (callback == null) {
      callback = function (error) {}
    }
    if (attrs == null) {
      attrs = {}
    }
    for (const key of ['project_id', 'doc_id', 'user_id']) {
      attrs[key] = client.ol_context[key]
    }
    attrs.client_id = client.id
    attrs.err = error
    if (error.name === 'CodedError') {
      logger.warn(attrs, error.message, { code: error.code })
      return callback({ message: error.message, code: error.code })
    }
    if (error.message === 'unexpected arguments') {
      // the payload might be very large, put it on level info
      logger.log(attrs, 'unexpected arguments')
      metrics.inc('unexpected-arguments', 1, { status: method })
      return callback({ message: error.message })
    }
    if (
      [
        'not authorized',
        'doc updater could not load requested ops',
        'no project_id found on client'
      ].includes(error.message)
    ) {
      logger.warn(attrs, error.message)
      return callback({ message: error.message })
    } else {
      logger.error(attrs, `server side error in ${method}`)
      // Don't return raw error to prevent leaking server side info
      return callback({ message: 'Something went wrong in real-time service' })
    }
  },

  _handleInvalidArguments(client, method, args) {
    const error = new Error('unexpected arguments')
    let callback = args[args.length - 1]
    if (typeof callback !== 'function') {
      callback = function () {}
    }
    const attrs = { arguments: args }
    return Router._handleError(callback, error, client, method, attrs)
  },

  configure(app, io, session) {
    app.set('io', io)
    app.get('/clients', HttpController.getConnectedClients)
    app.get('/clients/:client_id', HttpController.getConnectedClient)

    app.post(
      '/project/:project_id/message/:message',
      httpAuth,
      bodyParser.json({ limit: '5mb' }),
      HttpApiController.sendMessage
    )

    app.post('/drain', httpAuth, HttpApiController.startDrain)
    app.post(
      '/client/:client_id/disconnect',
      httpAuth,
      HttpApiController.disconnectClient
    )

    return session.on('connection', function (error, client, session) {
      // init client context, we may access it in Router._handleError before
      //  setting any values
      let user
      client.ol_context = {}

      if (client != null) {
        client.on('error', function (err) {
          logger.err({ clientErr: err }, 'socket.io client error')
          if (client.connected) {
            client.emit('reconnectGracefully')
            return client.disconnect()
          }
        })
      }

      if (settings.shutDownInProgress) {
        client.emit('connectionRejected', { message: 'retry' })
        client.disconnect()
        return
      }

      if (
        client != null &&
        __guard__(error != null ? error.message : undefined, (x) =>
          x.match(/could not look up session by key/)
        )
      ) {
        logger.warn(
          { err: error, client: client != null, session: session != null },
          'invalid session'
        )
        // tell the client to reauthenticate if it has an invalid session key
        client.emit('connectionRejected', { message: 'invalid session' })
        client.disconnect()
        return
      }

      if (error != null) {
        logger.err(
          { err: error, client: client != null, session: session != null },
          'error when client connected'
        )
        if (client != null) {
          client.emit('connectionRejected', { message: 'error' })
        }
        if (client != null) {
          client.disconnect()
        }
        return
      }

      // send positive confirmation that the client has a valid connection
      client.publicId = 'P.' + base64id.generateId()
      client.emit('connectionAccepted', null, client.publicId)

      metrics.inc('socket-io.connection')
      metrics.gauge(
        'socket-io.clients',
        __guard__(io.sockets.clients(), (x1) => x1.length)
      )

      logger.log({ session, client_id: client.id }, 'client connected')

      if (
        __guard__(
          session != null ? session.passport : undefined,
          (x2) => x2.user
        ) != null
      ) {
        ;({ user } = session.passport)
      } else if ((session != null ? session.user : undefined) != null) {
        ;({ user } = session)
      } else {
        user = { _id: 'anonymous-user' }
      }

      client.on('joinProject', function (data, callback) {
        if (data == null) {
          data = {}
        }
        if (typeof callback !== 'function') {
          return Router._handleInvalidArguments(
            client,
            'joinProject',
            arguments
          )
        }

        if (data.anonymousAccessToken) {
          user.anonymousAccessToken = data.anonymousAccessToken
        }
        return WebsocketController.joinProject(
          client,
          user,
          data.project_id,
          function (err, ...args) {
            if (err != null) {
              return Router._handleError(callback, err, client, 'joinProject', {
                project_id: data.project_id,
                user_id: user != null ? user.id : undefined
              })
            } else {
              return callback(null, ...Array.from(args))
            }
          }
        )
      })

      client.on('disconnect', function () {
        metrics.inc('socket-io.disconnect')
        metrics.gauge(
          'socket-io.clients',
          __guard__(io.sockets.clients(), (x3) => x3.length) - 1
        )

        return WebsocketController.leaveProject(io, client, function (err) {
          if (err != null) {
            return Router._handleError(
              function () {},
              err,
              client,
              'leaveProject'
            )
          }
        })
      })

      // Variadic. The possible arguments:
      // doc_id, callback
      // doc_id, fromVersion, callback
      // doc_id, options, callback
      // doc_id, fromVersion, options, callback
      client.on('joinDoc', function (doc_id, fromVersion, options, callback) {
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

        return WebsocketController.joinDoc(
          client,
          doc_id,
          fromVersion,
          options,
          function (err, ...args) {
            if (err != null) {
              return Router._handleError(callback, err, client, 'joinDoc', {
                doc_id,
                fromVersion
              })
            } else {
              return callback(null, ...Array.from(args))
            }
          }
        )
      })

      client.on('leaveDoc', function (doc_id, callback) {
        if (typeof callback !== 'function') {
          return Router._handleInvalidArguments(client, 'leaveDoc', arguments)
        }

        return WebsocketController.leaveDoc(client, doc_id, function (
          err,
          ...args
        ) {
          if (err != null) {
            return Router._handleError(callback, err, client, 'leaveDoc')
          } else {
            return callback(null, ...Array.from(args))
          }
        })
      })

      client.on('clientTracking.getConnectedUsers', function (callback) {
        if (callback == null) {
          callback = function (error, users) {}
        }
        if (typeof callback !== 'function') {
          return Router._handleInvalidArguments(
            client,
            'clientTracking.getConnectedUsers',
            arguments
          )
        }

        return WebsocketController.getConnectedUsers(client, function (
          err,
          users
        ) {
          if (err != null) {
            return Router._handleError(
              callback,
              err,
              client,
              'clientTracking.getConnectedUsers'
            )
          } else {
            return callback(null, users)
          }
        })
      })

      client.on('clientTracking.updatePosition', function (
        cursorData,
        callback
      ) {
        if (callback == null) {
          callback = function (error) {}
        }
        if (typeof callback !== 'function') {
          return Router._handleInvalidArguments(
            client,
            'clientTracking.updatePosition',
            arguments
          )
        }

        return WebsocketController.updateClientPosition(
          client,
          cursorData,
          function (err) {
            if (err != null) {
              return Router._handleError(
                callback,
                err,
                client,
                'clientTracking.updatePosition'
              )
            } else {
              return callback()
            }
          }
        )
      })

      return client.on('applyOtUpdate', function (doc_id, update, callback) {
        if (callback == null) {
          callback = function (error) {}
        }
        if (typeof callback !== 'function') {
          return Router._handleInvalidArguments(
            client,
            'applyOtUpdate',
            arguments
          )
        }

        return WebsocketController.applyOtUpdate(
          client,
          doc_id,
          update,
          function (err) {
            if (err != null) {
              return Router._handleError(
                callback,
                err,
                client,
                'applyOtUpdate',
                { doc_id, update }
              )
            } else {
              return callback()
            }
          }
        )
      })
    })
  }
}

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
