/* eslint-disable
    camelcase,
*/
const logger = require('logger-sharelatex')
const metrics = require('metrics-sharelatex')
const WebApiManager = require('./WebApiManager')
const AuthorizationManager = require('./AuthorizationManager')
const DocumentUpdaterManager = require('./DocumentUpdaterManager')
const ConnectedUsersManager = require('./ConnectedUsersManager')
const WebsocketLoadBalancer = require('./WebsocketLoadBalancer')
const RoomManager = require('./RoomManager')

let WebsocketController
module.exports = WebsocketController = {
  // If the protocol version changes when the client reconnects,
  // it will force a full refresh of the page. Useful for non-backwards
  // compatible protocol changes. Use only in extreme need.
  PROTOCOL_VERSION: 2,

  joinProject(client, user, project_id, callback) {
    if (client.disconnected) {
      metrics.inc('editor.join-project.disconnected', 1, {
        status: 'immediately'
      })
      return callback()
    }

    const user_id = user._id
    logger.log(
      { user_id, project_id, client_id: client.id },
      'user joining project'
    )
    metrics.inc('editor.join-project')
    WebApiManager.joinProject(project_id, user, function (
      error,
      project,
      privilegeLevel,
      isRestrictedUser
    ) {
      if (error) {
        return callback(error)
      }
      if (client.disconnected) {
        metrics.inc('editor.join-project.disconnected', 1, {
          status: 'after-web-api-call'
        })
        return callback()
      }

      if (!privilegeLevel) {
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
      client.ol_context.owner_id = project.owner && project.owner._id
      client.ol_context.first_name = user.first_name
      client.ol_context.last_name = user.last_name
      client.ol_context.email = user.email
      client.ol_context.connected_time = new Date()
      client.ol_context.signup_date = user.signUpDate
      client.ol_context.login_count = user.loginCount
      client.ol_context.is_restricted_user = !!isRestrictedUser

      RoomManager.joinProject(client, project_id, function (err) {
        if (err) {
          return callback(err)
        }
        logger.log(
          { user_id, project_id, client_id: client.id },
          'user joined project'
        )
        callback(
          null,
          project,
          privilegeLevel,
          WebsocketController.PROTOCOL_VERSION
        )
      })

      // No need to block for setting the user as connected in the cursor tracking
      ConnectedUsersManager.updateUserPosition(
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
        if (err) {
          logger.error(
            { err, project_id, user_id, client_id: client.id },
            'error marking client as disconnected'
          )
        }
      }
    )

    RoomManager.leaveProjectAndDocs(client)
    setTimeout(function () {
      const remainingClients = io.sockets.clients(project_id)
      if (remainingClients.length === 0) {
        // Flush project in the background
        DocumentUpdaterManager.flushProjectToMongoAndDelete(
          project_id,
          function (err) {
            if (err) {
              logger.error(
                { err, project_id, user_id, client_id: client.id },
                'error flushing to doc updater after leaving project'
              )
            }
          }
        )
      }
      callback()
    }, WebsocketController.FLUSH_IF_EMPTY_DELAY)
  },

  joinDoc(client, doc_id, fromVersion, options, callback) {
    if (client.disconnected) {
      metrics.inc('editor.join-doc.disconnected', 1, { status: 'immediately' })
      return callback()
    }

    const joinLeaveEpoch = ++client.joinLeaveEpoch
    metrics.inc('editor.join-doc')
    const { project_id, user_id, is_restricted_user } = client.ol_context
    if (!project_id) {
      return callback(new Error('no project_id found on client'))
    }
    logger.log(
      { user_id, project_id, doc_id, fromVersion, client_id: client.id },
      'client joining doc'
    )

    WebsocketController._assertClientAuthorization(client, doc_id, function (
      error
    ) {
      if (error) {
        return callback(error)
      }
      if (client.disconnected) {
        metrics.inc('editor.join-doc.disconnected', 1, {
          status: 'after-client-auth-check'
        })
        // the client will not read the response anyways
        return callback()
      }
      if (joinLeaveEpoch !== client.joinLeaveEpoch) {
        // another joinDoc or leaveDoc rpc overtook us
        return callback(new Error('joinLeaveEpoch mismatch'))
      }
      // ensure the per-doc applied-ops channel is subscribed before sending the
      // doc to the client, so that no events are missed.
      RoomManager.joinDoc(client, doc_id, function (error) {
        if (error) {
          return callback(error)
        }
        if (client.disconnected) {
          metrics.inc('editor.join-doc.disconnected', 1, {
            status: 'after-joining-room'
          })
          // the client will not read the response anyways
          return callback()
        }

        DocumentUpdaterManager.getDocument(
          project_id,
          doc_id,
          fromVersion,
          function (error, lines, version, ranges, ops) {
            if (error) {
              return callback(error)
            }
            if (client.disconnected) {
              metrics.inc('editor.join-doc.disconnected', 1, {
                status: 'after-doc-updater-call'
              })
              // the client will not read the response anyways
              return callback()
            }

            if (is_restricted_user && ranges && ranges.comments) {
              ranges.comments = []
            }

            // Encode any binary bits of data so it can go via WebSockets
            // See http://ecmanaut.blogspot.co.uk/2006/07/encoding-decoding-utf8-in-javascript.html
            const encodeForWebsockets = (text) =>
              unescape(encodeURIComponent(text))
            const escapedLines = []
            for (let line of lines) {
              try {
                line = encodeForWebsockets(line)
              } catch (err) {
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
                for (const comment of (ranges && ranges.comments) || []) {
                  if (comment.op.c) {
                    comment.op.c = encodeForWebsockets(comment.op.c)
                  }
                }
                for (const change of (ranges && ranges.changes) || []) {
                  if (change.op.i) {
                    change.op.i = encodeForWebsockets(change.op.i)
                  }
                  if (change.op.d) {
                    change.op.d = encodeForWebsockets(change.op.d)
                  }
                }
              } catch (err) {
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

            AuthorizationManager.addAccessToDoc(client, doc_id, () => {})
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
            callback(null, escapedLines, version, ops, ranges)
          }
        )
      })
    })
  },

  _assertClientAuthorization(client, doc_id, callback) {
    // Check for project-level access first
    AuthorizationManager.assertClientCanViewProject(client, function (error) {
      if (error) {
        return callback(error)
      }
      // Check for doc-level access next
      AuthorizationManager.assertClientCanViewProjectAndDoc(
        client,
        doc_id,
        function (error) {
          if (error) {
            // No cached access, check docupdater
            const { project_id } = client.ol_context
            DocumentUpdaterManager.checkDocument(project_id, doc_id, function (
              error
            ) {
              if (error) {
                return callback(error)
              } else {
                // Success
                AuthorizationManager.addAccessToDoc(client, doc_id, callback)
              }
            })
          } else {
            // Access already cached
            callback()
          }
        }
      )
    })
  },

  leaveDoc(client, doc_id, callback) {
    // client may have disconnected, but we have to cleanup internal state.
    client.joinLeaveEpoch++
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
    callback()
  },
  updateClientPosition(client, cursorData, callback) {
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

    AuthorizationManager.assertClientCanViewProjectAndDoc(
      client,
      cursorData.doc_id,
      function (error) {
        if (error) {
          logger.warn(
            { err: error, client_id: client.id, project_id, user_id },
            "silently ignoring unauthorized updateClientPosition. Client likely hasn't called joinProject yet."
          )
          return callback()
        }
        cursorData.id = client.publicId
        if (user_id) {
          cursorData.user_id = user_id
        }
        if (email) {
          cursorData.email = email
        }
        // Don't store anonymous users in redis to avoid influx
        if (!user_id || user_id === 'anonymous-user') {
          cursorData.name = ''
          // consistent async behaviour
          setTimeout(callback)
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
        WebsocketLoadBalancer.emitToRoom(
          project_id,
          'clientTracking.clientUpdated',
          cursorData
        )
      }
    )
  },

  CLIENT_REFRESH_DELAY: 1000,
  getConnectedUsers(client, callback) {
    if (client.disconnected) {
      // they are not interested anymore, skip the redis lookups
      return callback()
    }

    metrics.inc('editor.get-connected-users')
    const { project_id, user_id, is_restricted_user } = client.ol_context
    if (is_restricted_user) {
      return callback(null, [])
    }
    if (!project_id) {
      return callback(new Error('no project_id found on client'))
    }
    logger.log(
      { user_id, project_id, client_id: client.id },
      'getting connected users'
    )
    AuthorizationManager.assertClientCanViewProject(client, function (error) {
      if (error) {
        return callback(error)
      }
      WebsocketLoadBalancer.emitToRoom(project_id, 'clientTracking.refresh')
      setTimeout(
        () =>
          ConnectedUsersManager.getConnectedUsers(project_id, function (
            error,
            users
          ) {
            if (error) {
              return callback(error)
            }
            logger.log(
              { user_id, project_id, client_id: client.id },
              'got connected users'
            )
            callback(null, users)
          }),
        WebsocketController.CLIENT_REFRESH_DELAY
      )
    })
  },

  applyOtUpdate(client, doc_id, update, callback) {
    // client may have disconnected, but we can submit their update to doc-updater anyways.
    const { user_id, project_id } = client.ol_context
    if (!project_id) {
      return callback(new Error('no project_id found on client'))
    }

    WebsocketController._assertClientCanApplyUpdate(
      client,
      doc_id,
      update,
      function (error) {
        if (error) {
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

        DocumentUpdaterManager.queueChange(
          project_id,
          doc_id,
          update,
          function (error) {
            if ((error && error.message) === 'update is too large') {
              metrics.inc('update_too_large')
              const { updateSize } = error.info
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
                client.disconnect()
              }, 100)
              return
            }

            if (error) {
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
            callback(error)
          }
        )
      }
    )
  },

  _assertClientCanApplyUpdate(client, doc_id, update, callback) {
    AuthorizationManager.assertClientCanEditProjectAndDoc(
      client,
      doc_id,
      function (error) {
        if (
          error &&
          error.message === 'not authorized' &&
          WebsocketController._isCommentUpdate(update)
        ) {
          // This might be a comment op, which we only need read-only priveleges for
          AuthorizationManager.assertClientCanViewProjectAndDoc(
            client,
            doc_id,
            callback
          )
          return
        }
        callback(error)
      }
    )
  },

  _isCommentUpdate(update) {
    if (!(update && update.op instanceof Array)) {
      return false
    }
    for (const op of update.op) {
      if (!op.c) {
        return false
      }
    }
    return true
  }
}
