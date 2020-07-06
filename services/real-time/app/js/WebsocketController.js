/* eslint-disable
    camelcase,
    handle-callback-err,
    no-unused-vars,
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
let WebsocketController
const logger = require('logger-sharelatex')
const metrics = require('metrics-sharelatex')
const settings = require('settings-sharelatex')
const WebApiManager = require('./WebApiManager')
const AuthorizationManager = require('./AuthorizationManager')
const DocumentUpdaterManager = require('./DocumentUpdaterManager')
const ConnectedUsersManager = require('./ConnectedUsersManager')
const WebsocketLoadBalancer = require('./WebsocketLoadBalancer')
const RoomManager = require('./RoomManager')

module.exports = WebsocketController = {
  // If the protocol version changes when the client reconnects,
  // it will force a full refresh of the page. Useful for non-backwards
  // compatible protocol changes. Use only in extreme need.
  PROTOCOL_VERSION: 2,

  joinProject(client, user, project_id, callback) {
    if (callback == null) {
      callback = function (error, project, privilegeLevel, protocolVersion) {}
    }
    if (client.disconnected) {
      metrics.inc('editor.join-project.disconnected', 1, {
        status: 'immediately'
      })
      return callback()
    }

    const user_id = user != null ? user._id : undefined
    logger.log(
      { user_id, project_id, client_id: client.id },
      'user joining project'
    )
    metrics.inc('editor.join-project')
    return WebApiManager.joinProject(project_id, user, function (
      error,
      project,
      privilegeLevel,
      isRestrictedUser
    ) {
      if (error != null) {
        return callback(error)
      }
      if (client.disconnected) {
        metrics.inc('editor.join-project.disconnected', 1, {
          status: 'after-web-api-call'
        })
        return callback()
      }

      if (!privilegeLevel || privilegeLevel === '') {
        const err = new Error('not authorized')
        logger.warn(
          { err, project_id, user_id, client_id: client.id },
          'user is not authorized to join project'
        )
        return callback(err)
      }

      client.ol_context = {}
      client.ol_context.privilege_level = privilegeLevel
      client.ol_context.user_id = user_id
      client.ol_context.project_id = project_id
      client.ol_context.owner_id = __guard__(
        project != null ? project.owner : undefined,
        (x) => x._id
      )
      client.ol_context.first_name = user != null ? user.first_name : undefined
      client.ol_context.last_name = user != null ? user.last_name : undefined
      client.ol_context.email = user != null ? user.email : undefined
      client.ol_context.connected_time = new Date()
      client.ol_context.signup_date = user != null ? user.signUpDate : undefined
      client.ol_context.login_count = user != null ? user.loginCount : undefined
      client.ol_context.is_restricted_user = !!isRestrictedUser

      RoomManager.joinProject(client, project_id, function (err) {
        if (err) {
          return callback(err)
        }
        logger.log(
          { user_id, project_id, client_id: client.id },
          'user joined project'
        )
        return callback(
          null,
          project,
          privilegeLevel,
          WebsocketController.PROTOCOL_VERSION
        )
      })

      // No need to block for setting the user as connected in the cursor tracking
      return ConnectedUsersManager.updateUserPosition(
        project_id,
        client.publicId,
        user,
        null,
        function () {}
      )
    })
  },

  // We want to flush a project if there are no more (local) connected clients
  // but we need to wait for the triggering client to disconnect. How long we wait
  // is determined by FLUSH_IF_EMPTY_DELAY.
  FLUSH_IF_EMPTY_DELAY: 500, // ms
  leaveProject(io, client, callback) {
    if (callback == null) {
      callback = function (error) {}
    }
    const { project_id, user_id } = client.ol_context
    if (!project_id) {
      return callback()
    } // client did not join project

    metrics.inc('editor.leave-project')
    logger.log(
      { project_id, user_id, client_id: client.id },
      'client leaving project'
    )
    WebsocketLoadBalancer.emitToRoom(
      project_id,
      'clientTracking.clientDisconnected',
      client.publicId
    )

    // We can do this in the background
    ConnectedUsersManager.markUserAsDisconnected(
      project_id,
      client.publicId,
      function (err) {
        if (err != null) {
          return logger.error(
            { err, project_id, user_id, client_id: client.id },
            'error marking client as disconnected'
          )
        }
      }
    )

    RoomManager.leaveProjectAndDocs(client)
    return setTimeout(function () {
      const remainingClients = io.sockets.clients(project_id)
      if (remainingClients.length === 0) {
        // Flush project in the background
        DocumentUpdaterManager.flushProjectToMongoAndDelete(
          project_id,
          function (err) {
            if (err != null) {
              return logger.error(
                { err, project_id, user_id, client_id: client.id },
                'error flushing to doc updater after leaving project'
              )
            }
          }
        )
      }
      return callback()
    }, WebsocketController.FLUSH_IF_EMPTY_DELAY)
  },

  joinDoc(client, doc_id, fromVersion, options, callback) {
    if (fromVersion == null) {
      fromVersion = -1
    }
    if (callback == null) {
      callback = function (error, doclines, version, ops, ranges) {}
    }
    if (client.disconnected) {
      metrics.inc('editor.join-doc.disconnected', 1, { status: 'immediately' })
      return callback()
    }

    metrics.inc('editor.join-doc')
    const { project_id, user_id, is_restricted_user } = client.ol_context
    if (project_id == null) {
      return callback(new Error('no project_id found on client'))
    }
    logger.log(
      { user_id, project_id, doc_id, fromVersion, client_id: client.id },
      'client joining doc'
    )

    return AuthorizationManager.assertClientCanViewProject(client, function (
      error
    ) {
      if (error != null) {
        return callback(error)
      }
      // ensure the per-doc applied-ops channel is subscribed before sending the
      // doc to the client, so that no events are missed.
      return RoomManager.joinDoc(client, doc_id, function (error) {
        if (error != null) {
          return callback(error)
        }
        if (client.disconnected) {
          metrics.inc('editor.join-doc.disconnected', 1, {
            status: 'after-joining-room'
          })
          // the client will not read the response anyways
          return callback()
        }

        return DocumentUpdaterManager.getDocument(
          project_id,
          doc_id,
          fromVersion,
          function (error, lines, version, ranges, ops) {
            let err
            if (error != null) {
              return callback(error)
            }
            if (client.disconnected) {
              metrics.inc('editor.join-doc.disconnected', 1, {
                status: 'after-doc-updater-call'
              })
              // the client will not read the response anyways
              return callback()
            }

            if (
              is_restricted_user &&
              (ranges != null ? ranges.comments : undefined) != null
            ) {
              ranges.comments = []
            }

            // Encode any binary bits of data so it can go via WebSockets
            // See http://ecmanaut.blogspot.co.uk/2006/07/encoding-decoding-utf8-in-javascript.html
            const encodeForWebsockets = (text) =>
              unescape(encodeURIComponent(text))
            const escapedLines = []
            for (let line of Array.from(lines)) {
              try {
                line = encodeForWebsockets(line)
              } catch (error1) {
                err = error1
                logger.err(
                  {
                    err,
                    project_id,
                    doc_id,
                    fromVersion,
                    line,
                    client_id: client.id
                  },
                  'error encoding line uri component'
                )
                return callback(err)
              }
              escapedLines.push(line)
            }
            if (options.encodeRanges) {
              try {
                for (const comment of Array.from(
                  (ranges != null ? ranges.comments : undefined) || []
                )) {
                  if (comment.op.c != null) {
                    comment.op.c = encodeForWebsockets(comment.op.c)
                  }
                }
                for (const change of Array.from(
                  (ranges != null ? ranges.changes : undefined) || []
                )) {
                  if (change.op.i != null) {
                    change.op.i = encodeForWebsockets(change.op.i)
                  }
                  if (change.op.d != null) {
                    change.op.d = encodeForWebsockets(change.op.d)
                  }
                }
              } catch (error2) {
                err = error2
                logger.err(
                  {
                    err,
                    project_id,
                    doc_id,
                    fromVersion,
                    ranges,
                    client_id: client.id
                  },
                  'error encoding range uri component'
                )
                return callback(err)
              }
            }

            AuthorizationManager.addAccessToDoc(client, doc_id)
            logger.log(
              {
                user_id,
                project_id,
                doc_id,
                fromVersion,
                client_id: client.id
              },
              'client joined doc'
            )
            return callback(null, escapedLines, version, ops, ranges)
          }
        )
      })
    })
  },

  leaveDoc(client, doc_id, callback) {
    // client may have disconnected, but we have to cleanup internal state.
    if (callback == null) {
      callback = function (error) {}
    }
    metrics.inc('editor.leave-doc')
    const { project_id, user_id } = client.ol_context
    logger.log(
      { user_id, project_id, doc_id, client_id: client.id },
      'client leaving doc'
    )
    RoomManager.leaveDoc(client, doc_id)
    // we could remove permission when user leaves a doc, but because
    // the connection is per-project, we continue to allow access
    // after the initial joinDoc since we know they are already authorised.
    // # AuthorizationManager.removeAccessToDoc client, doc_id
    return callback()
  },
  updateClientPosition(client, cursorData, callback) {
    if (callback == null) {
      callback = function (error) {}
    }
    if (client.disconnected) {
      // do not create a ghost entry in redis
      return callback()
    }

    metrics.inc('editor.update-client-position', 0.1)
    const {
      project_id,
      first_name,
      last_name,
      email,
      user_id
    } = client.ol_context
    logger.log(
      { user_id, project_id, client_id: client.id, cursorData },
      'updating client position'
    )

    return AuthorizationManager.assertClientCanViewProjectAndDoc(
      client,
      cursorData.doc_id,
      function (error) {
        if (error != null) {
          logger.warn(
            { err: error, client_id: client.id, project_id, user_id },
            "silently ignoring unauthorized updateClientPosition. Client likely hasn't called joinProject yet."
          )
          return callback()
        }
        cursorData.id = client.publicId
        if (user_id != null) {
          cursorData.user_id = user_id
        }
        if (email != null) {
          cursorData.email = email
        }
        // Don't store anonymous users in redis to avoid influx
        if (!user_id || user_id === 'anonymous-user') {
          cursorData.name = ''
          callback()
        } else {
          cursorData.name =
            first_name && last_name
              ? `${first_name} ${last_name}`
              : first_name || last_name || ''
          ConnectedUsersManager.updateUserPosition(
            project_id,
            client.publicId,
            {
              first_name,
              last_name,
              email,
              _id: user_id
            },
            {
              row: cursorData.row,
              column: cursorData.column,
              doc_id: cursorData.doc_id
            },
            callback
          )
        }
        return WebsocketLoadBalancer.emitToRoom(
          project_id,
          'clientTracking.clientUpdated',
          cursorData
        )
      }
    )
  },

  CLIENT_REFRESH_DELAY: 1000,
  getConnectedUsers(client, callback) {
    if (callback == null) {
      callback = function (error, users) {}
    }
    if (client.disconnected) {
      // they are not interested anymore, skip the redis lookups
      return callback()
    }

    metrics.inc('editor.get-connected-users')
    const { project_id, user_id, is_restricted_user } = client.ol_context
    if (is_restricted_user) {
      return callback(null, [])
    }
    if (project_id == null) {
      return callback(new Error('no project_id found on client'))
    }
    logger.log(
      { user_id, project_id, client_id: client.id },
      'getting connected users'
    )
    return AuthorizationManager.assertClientCanViewProject(client, function (
      error
    ) {
      if (error != null) {
        return callback(error)
      }
      WebsocketLoadBalancer.emitToRoom(project_id, 'clientTracking.refresh')
      return setTimeout(
        () =>
          ConnectedUsersManager.getConnectedUsers(project_id, function (
            error,
            users
          ) {
            if (error != null) {
              return callback(error)
            }
            callback(null, users)
            return logger.log(
              { user_id, project_id, client_id: client.id },
              'got connected users'
            )
          }),
        WebsocketController.CLIENT_REFRESH_DELAY
      )
    })
  },

  applyOtUpdate(client, doc_id, update, callback) {
    // client may have disconnected, but we can submit their update to doc-updater anyways.
    if (callback == null) {
      callback = function (error) {}
    }
    const { user_id, project_id } = client.ol_context
    if (project_id == null) {
      return callback(new Error('no project_id found on client'))
    }

    return WebsocketController._assertClientCanApplyUpdate(
      client,
      doc_id,
      update,
      function (error) {
        if (error != null) {
          logger.warn(
            { err: error, doc_id, client_id: client.id, version: update.v },
            'client is not authorized to make update'
          )
          setTimeout(
            () =>
              // Disconnect, but give the client the chance to receive the error
              client.disconnect(),
            100
          )
          return callback(error)
        }
        if (!update.meta) {
          update.meta = {}
        }
        update.meta.source = client.publicId
        update.meta.user_id = user_id
        metrics.inc('editor.doc-update', 0.3)

        logger.log(
          {
            user_id,
            doc_id,
            project_id,
            client_id: client.id,
            version: update.v
          },
          'sending update to doc updater'
        )

        return DocumentUpdaterManager.queueChange(
          project_id,
          doc_id,
          update,
          function (error) {
            if (
              (error != null ? error.message : undefined) ===
              'update is too large'
            ) {
              metrics.inc('update_too_large')
              const { updateSize } = error
              logger.warn(
                { user_id, project_id, doc_id, updateSize },
                'update is too large'
              )

              // mark the update as received -- the client should not send it again!
              callback()

              // trigger an out-of-sync error
              const message = {
                project_id,
                doc_id,
                error: 'update is too large'
              }
              setTimeout(function () {
                if (client.disconnected) {
                  // skip the message broadcast, the client has moved on
                  return metrics.inc('editor.doc-update.disconnected', 1, {
                    status: 'at-otUpdateError'
                  })
                }
                client.emit('otUpdateError', message.error, message)
                return client.disconnect()
              }, 100)
              return
            }

            if (error != null) {
              logger.error(
                {
                  err: error,
                  project_id,
                  doc_id,
                  client_id: client.id,
                  version: update.v
                },
                'document was not available for update'
              )
              client.disconnect()
            }
            return callback(error)
          }
        )
      }
    )
  },

  _assertClientCanApplyUpdate(client, doc_id, update, callback) {
    return AuthorizationManager.assertClientCanEditProjectAndDoc(
      client,
      doc_id,
      function (error) {
        if (error != null) {
          if (
            error.message === 'not authorized' &&
            WebsocketController._isCommentUpdate(update)
          ) {
            // This might be a comment op, which we only need read-only priveleges for
            return AuthorizationManager.assertClientCanViewProjectAndDoc(
              client,
              doc_id,
              callback
            )
          } else {
            return callback(error)
          }
        } else {
          return callback(null)
        }
      }
    )
  },

  _isCommentUpdate(update) {
    for (const op of Array.from(update.op)) {
      if (op.c == null) {
        return false
      }
    }
    return true
  }
}

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
