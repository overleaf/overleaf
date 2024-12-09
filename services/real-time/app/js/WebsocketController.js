const OError = require('@overleaf/o-error')
const logger = require('@overleaf/logger')
const metrics = require('@overleaf/metrics')
const WebApiManager = require('./WebApiManager')
const AuthorizationManager = require('./AuthorizationManager')
const DocumentUpdaterManager = require('./DocumentUpdaterManager')
const ConnectedUsersManager = require('./ConnectedUsersManager')
const WebsocketLoadBalancer = require('./WebsocketLoadBalancer')
const RoomManager = require('./RoomManager')
const {
  JoinLeaveEpochMismatchError,
  NotAuthorizedError,
  NotJoinedError,
  ClientRequestedMissingOpsError,
} = require('./Errors')

const JOIN_DOC_CATCH_UP_LENGTH_BUCKETS = [
  0, 5, 10, 25, 50, 100, 150, 200, 250, 500, 1000,
]
const JOIN_DOC_CATCH_UP_AGE = [
  0,
  1,
  2,
  5,
  10,
  20,
  30,
  60,
  120,
  240,
  600,
  60 * 60,
  24 * 60 * 60,
].map(x => x * 1000)

let WebsocketController
module.exports = WebsocketController = {
  // If the protocol version changes when the client reconnects,
  // it will force a full refresh of the page. Useful for non-backwards
  // compatible protocol changes. Use only in extreme need.
  PROTOCOL_VERSION: 2,

  joinProject(client, user, projectId, callback) {
    if (client.disconnected) {
      metrics.inc('editor.join-project.disconnected', 1, {
        status: 'immediately',
      })
      return callback()
    }

    const userId = user._id
    logger.info(
      {
        userId,
        projectId,
        clientId: client.id,
        remoteIp: client.remoteIp,
        userAgent: client.userAgent,
      },
      'user joining project'
    )
    metrics.inc('editor.join-project', 1, { status: client.transport })
    WebApiManager.joinProject(
      projectId,
      user,
      function (error, project, privilegeLevel, userMetadata) {
        if (error) {
          return callback(error)
        }
        if (client.disconnected) {
          logger.info(
            { userId, projectId, clientId: client.id },
            'client disconnected before joining project'
          )
          metrics.inc('editor.join-project.disconnected', 1, {
            status: 'after-web-api-call',
          })
          return callback()
        }

        if (!privilegeLevel) {
          return callback(new NotAuthorizedError())
        }

        client.ol_context = {}
        client.ol_context.privilege_level = privilegeLevel
        client.ol_context.user_id = userId
        client.ol_context.project_id = projectId
        client.ol_context.owner_id = project.owner && project.owner._id
        client.ol_context.first_name = user.first_name
        client.ol_context.last_name = user.last_name
        client.ol_context.email = user.email
        client.ol_context.connected_time = new Date()
        client.ol_context.signup_date = user.signUpDate
        client.ol_context.login_count = user.loginCount
        client.ol_context.is_restricted_user = !!userMetadata.isRestrictedUser
        client.ol_context.is_token_member = !!userMetadata.isTokenMember
        client.ol_context.is_invited_member = !!userMetadata.isInvitedMember

        RoomManager.joinProject(client, projectId, function (err) {
          if (err) {
            return callback(err)
          }
          logger.debug(
            {
              userId,
              projectId,
              clientId: client.id,
              privilegeLevel,
              userMetadata,
            },
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
          projectId,
          client.publicId,
          user,
          null,
          function (err) {
            if (err) {
              logger.warn(
                { err, projectId, userId, clientId: client.id },
                'background cursor update failed'
              )
            }
          }
        )
      }
    )
  },

  // We want to flush a project if there are no more (local) connected clients
  // but we need to wait for the triggering client to disconnect. How long we wait
  // is determined by FLUSH_IF_EMPTY_DELAY.
  FLUSH_IF_EMPTY_DELAY: 500, // ms
  leaveProject(io, client, callback) {
    const { project_id: projectId, user_id: userId } = client.ol_context
    if (!projectId) {
      return callback()
    } // client did not join project

    metrics.inc('editor.leave-project', 1, { status: client.transport })
    logger.info(
      { projectId, userId, clientId: client.id },
      'client leaving project'
    )
    WebsocketLoadBalancer.emitToRoom(
      projectId,
      'clientTracking.clientDisconnected',
      client.publicId
    )

    // We can do this in the background
    ConnectedUsersManager.markUserAsDisconnected(
      projectId,
      client.publicId,
      function (err) {
        if (err) {
          logger.error(
            { err, projectId, userId, clientId: client.id },
            'error marking client as disconnected'
          )
        }
      }
    )

    RoomManager.leaveProjectAndDocs(client)
    setTimeout(function () {
      const remainingClients = io.sockets.clients(projectId)
      if (remainingClients.length === 0) {
        // Flush project in the background
        DocumentUpdaterManager.flushProjectToMongoAndDelete(
          projectId,
          function (err) {
            if (err) {
              logger.error(
                { err, projectId, userId, clientId: client.id },
                'error flushing to doc updater after leaving project'
              )
            }
          }
        )
      }
      callback()
    }, WebsocketController.FLUSH_IF_EMPTY_DELAY)
  },

  joinDoc(client, docId, fromVersion, options, callback) {
    if (client.disconnected) {
      metrics.inc('editor.join-doc.disconnected', 1, { status: 'immediately' })
      return callback()
    }

    const joinLeaveEpoch = ++client.joinLeaveEpoch
    metrics.inc('editor.join-doc', 1, { status: client.transport })
    const {
      project_id: projectId,
      user_id: userId,
      is_restricted_user: isRestrictedUser,
    } = client.ol_context
    if (!projectId) {
      return callback(new NotJoinedError())
    }
    logger.debug(
      { userId, projectId, docId, fromVersion, clientId: client.id },
      'client joining doc'
    )

    const emitJoinDocCatchUpMetrics = (
      status,
      { firstVersionInRedis, version, ttlInS }
    ) => {
      if (fromVersion === -1) return // full joinDoc call
      if (typeof options.age !== 'number') return // old frontend
      if (!ttlInS) return // old document-updater pod

      const isStale = options.age > ttlInS * 1000
      const method = isStale ? 'stale' : 'recent'
      metrics.histogram(
        'join-doc-catch-up-length',
        version - fromVersion,
        JOIN_DOC_CATCH_UP_LENGTH_BUCKETS,
        { status, method, path: client.transport }
      )
      if (firstVersionInRedis) {
        metrics.histogram(
          'join-doc-catch-up-length-extra-needed',
          firstVersionInRedis - fromVersion,
          JOIN_DOC_CATCH_UP_LENGTH_BUCKETS,
          { status, method, path: client.transport }
        )
      }
      metrics.histogram(
        'join-doc-catch-up-age',
        options.age,
        JOIN_DOC_CATCH_UP_AGE,
        { status, path: client.transport }
      )
    }

    WebsocketController._assertClientAuthorization(
      client,
      docId,
      function (error) {
        if (error) {
          return callback(error)
        }
        if (client.disconnected) {
          metrics.inc('editor.join-doc.disconnected', 1, {
            status: 'after-client-auth-check',
          })
          // the client will not read the response anyways
          return callback()
        }
        if (joinLeaveEpoch !== client.joinLeaveEpoch) {
          // another joinDoc or leaveDoc rpc overtook us
          return callback(new JoinLeaveEpochMismatchError())
        }
        // ensure the per-doc applied-ops channel is subscribed before sending the
        // doc to the client, so that no events are missed.
        RoomManager.joinDoc(client, docId, function (error) {
          if (error) {
            return callback(error)
          }
          if (client.disconnected) {
            metrics.inc('editor.join-doc.disconnected', 1, {
              status: 'after-joining-room',
            })
            // the client will not read the response anyways
            return callback()
          }

          DocumentUpdaterManager.getDocument(
            projectId,
            docId,
            fromVersion,
            function (error, lines, version, ranges, ops, ttlInS) {
              if (error) {
                if (error instanceof ClientRequestedMissingOpsError) {
                  emitJoinDocCatchUpMetrics('missing', error.info)
                }
                return callback(error)
              }
              emitJoinDocCatchUpMetrics('success', { version, ttlInS })
              if (client.disconnected) {
                metrics.inc('editor.join-doc.disconnected', 1, {
                  status: 'after-doc-updater-call',
                })
                // the client will not read the response anyways
                return callback()
              }

              if (isRestrictedUser && ranges && ranges.comments) {
                ranges.comments = []
              }

              // Encode any binary bits of data so it can go via WebSockets
              // See http://ecmanaut.blogspot.co.uk/2006/07/encoding-decoding-utf8-in-javascript.html
              const encodeForWebsockets = text =>
                unescape(encodeURIComponent(text))
              const escapedLines = []
              for (let line of lines) {
                try {
                  line = encodeForWebsockets(line)
                } catch (err) {
                  OError.tag(err, 'error encoding line uri component', { line })
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
                  OError.tag(err, 'error encoding range uri component', {
                    ranges,
                  })
                  return callback(err)
                }
              }

              AuthorizationManager.addAccessToDoc(client, docId, () => {})
              logger.debug(
                {
                  userId,
                  projectId,
                  docId,
                  fromVersion,
                  clientId: client.id,
                },
                'client joined doc'
              )
              callback(null, escapedLines, version, ops, ranges)
            }
          )
        })
      }
    )
  },

  _assertClientAuthorization(client, docId, callback) {
    // Check for project-level access first
    AuthorizationManager.assertClientCanViewProject(client, function (error) {
      if (error) {
        return callback(error)
      }
      // Check for doc-level access next
      AuthorizationManager.assertClientCanViewProjectAndDoc(
        client,
        docId,
        function (error) {
          if (error) {
            // No cached access, check docupdater
            const { project_id: projectId } = client.ol_context
            DocumentUpdaterManager.checkDocument(
              projectId,
              docId,
              function (error) {
                if (error) {
                  return callback(error)
                } else {
                  // Success
                  AuthorizationManager.addAccessToDoc(client, docId, callback)
                }
              }
            )
          } else {
            // Access already cached
            callback()
          }
        }
      )
    })
  },

  leaveDoc(client, docId, callback) {
    // client may have disconnected, but we have to cleanup internal state.
    client.joinLeaveEpoch++
    metrics.inc('editor.leave-doc', 1, { status: client.transport })
    const { project_id: projectId, user_id: userId } = client.ol_context
    logger.debug(
      { userId, projectId, docId, clientId: client.id },
      'client leaving doc'
    )
    RoomManager.leaveDoc(client, docId)
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

    metrics.inc('editor.update-client-position', 0.1, {
      status: client.transport,
    })
    const {
      project_id: projectId,
      first_name: firstName,
      last_name: lastName,
      email,
      user_id: userId,
    } = client.ol_context
    logger.debug(
      { userId, projectId, clientId: client.id, cursorData },
      'updating client position'
    )

    AuthorizationManager.assertClientCanViewProjectAndDoc(
      client,
      cursorData.doc_id,
      function (error) {
        if (error) {
          logger.debug(
            { err: error, clientId: client.id, projectId, userId },
            "silently ignoring unauthorized updateClientPosition. Client likely hasn't called joinProject yet."
          )
          return callback()
        }
        cursorData.id = client.publicId
        if (userId) {
          cursorData.user_id = userId
        }
        if (email) {
          cursorData.email = email
        }
        // Don't store anonymous users in redis to avoid influx
        if (!userId || userId === 'anonymous-user') {
          cursorData.name = ''
          // consistent async behaviour
          setTimeout(callback)
        } else {
          cursorData.name =
            firstName && lastName
              ? `${firstName} ${lastName}`
              : firstName || lastName || ''
          ConnectedUsersManager.updateUserPosition(
            projectId,
            client.publicId,
            {
              first_name: firstName,
              last_name: lastName,
              email,
              _id: userId,
            },
            {
              row: cursorData.row,
              column: cursorData.column,
              doc_id: cursorData.doc_id,
            },
            callback
          )
        }
        WebsocketLoadBalancer.emitToRoom(
          projectId,
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

    metrics.inc('editor.get-connected-users', { status: client.transport })
    const {
      project_id: projectId,
      user_id: userId,
      is_restricted_user: isRestrictedUser,
    } = client.ol_context
    if (isRestrictedUser) {
      return callback(null, [])
    }
    if (!projectId) {
      return callback(new NotJoinedError())
    }
    logger.debug(
      { userId, projectId, clientId: client.id },
      'getting connected users'
    )
    AuthorizationManager.assertClientCanViewProject(client, function (error) {
      if (error) {
        return callback(error)
      }
      WebsocketLoadBalancer.emitToRoom(projectId, 'clientTracking.refresh')
      setTimeout(
        () =>
          ConnectedUsersManager.getConnectedUsers(
            projectId,
            function (error, users) {
              if (error) {
                return callback(error)
              }
              logger.debug(
                { userId, projectId, clientId: client.id },
                'got connected users'
              )
              callback(null, users)
            }
          ),
        WebsocketController.CLIENT_REFRESH_DELAY
      )
    })
  },

  applyOtUpdate(client, docId, update, callback) {
    // client may have disconnected, but we can submit their update to doc-updater anyways.
    const { user_id: userId, project_id: projectId } = client.ol_context
    if (!projectId) {
      return callback(new NotJoinedError())
    }

    WebsocketController._assertClientCanApplyUpdate(
      client,
      docId,
      update,
      function (error) {
        if (error) {
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
        update.meta.user_id = userId
        update.meta.tsRT = performance.now()
        metrics.inc('editor.doc-update', 0.3, { status: client.transport })

        logger.debug(
          {
            userId,
            docId,
            projectId,
            clientId: client.id,
            version: update.v,
          },
          'sending update to doc updater'
        )

        DocumentUpdaterManager.queueChange(
          projectId,
          docId,
          update,
          function (error) {
            if ((error && error.message) === 'update is too large') {
              metrics.inc('update_too_large')
              const { updateSize } = error.info
              logger.warn(
                { userId, projectId, docId, updateSize },
                'update is too large'
              )

              // mark the update as received -- the client should not send it again!
              callback()

              // trigger an out-of-sync error
              const message = {
                project_id: projectId,
                doc_id: docId,
                error: 'update is too large',
              }
              setTimeout(function () {
                if (client.disconnected) {
                  // skip the message broadcast, the client has moved on
                  return metrics.inc('editor.doc-update.disconnected', 1, {
                    status: 'at-otUpdateError',
                  })
                }
                client.emit('otUpdateError', message.error, message)
                client.disconnect()
              }, 100)
              return
            }

            if (error) {
              OError.tag(error, 'document was not available for update', {
                version: update.v,
              })
              client.disconnect()
            }
            callback(error)
          }
        )
      }
    )
  },

  _assertClientCanApplyUpdate(client, docId, update, callback) {
    if (WebsocketController._isCommentUpdate(update)) {
      return AuthorizationManager.assertClientCanViewProjectAndDoc(
        client,
        docId,
        callback
      )
    } else if (update.meta?.tc) {
      return AuthorizationManager.assertClientCanReviewProjectAndDoc(
        client,
        docId,
        callback
      )
    } else {
      return AuthorizationManager.assertClientCanEditProjectAndDoc(
        client,
        docId,
        callback
      )
    }
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
  },
}
