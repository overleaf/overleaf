/* eslint-disable
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let fiveMinutes, UpdatesManager
const MongoManager = require('./MongoManager')
const PackManager = require('./PackManager')
const RedisManager = require('./RedisManager')
const UpdateCompressor = require('./UpdateCompressor')
const LockManager = require('./LockManager')
const WebApiManager = require('./WebApiManager')
const UpdateTrimmer = require('./UpdateTrimmer')
const logger = require('@overleaf/logger')
const async = require('async')
const _ = require('underscore')
const Settings = require('@overleaf/settings')
const keys = Settings.redis.lock.key_schema
const util = require('util')

module.exports = UpdatesManager = {
  compressAndSaveRawUpdates(projectId, docId, rawUpdates, temporary, callback) {
    let i
    if (callback == null) {
      callback = function () {}
    }
    const { length } = rawUpdates
    if (length === 0) {
      return callback()
    }

    // check that ops are in the correct order
    for (i = 0; i < rawUpdates.length; i++) {
      const op = rawUpdates[i]
      if (i > 0) {
        const thisVersion = op != null ? op.v : undefined
        const prevVersion = rawUpdates[i - 1]?.v
        if (!(prevVersion < thisVersion)) {
          logger.error(
            {
              projectId,
              docId,
              rawUpdates,
              temporary,
              thisVersion,
              prevVersion,
            },
            'op versions out of order'
          )
        }
      }
    }

    // FIXME: we no longer need the lastCompressedUpdate, so change functions not to need it
    // CORRECTION:  we do use it to log the time in case of error
    return MongoManager.peekLastCompressedUpdate(
      docId,
      function (error, lastCompressedUpdate, lastVersion) {
        // lastCompressedUpdate is the most recent update in Mongo, and
        // lastVersion is its sharejs version number.
        //
        // The peekLastCompressedUpdate method may pass the update back
        // as 'null' (for example if the previous compressed update has
        // been archived).  In this case it can still pass back the
        // lastVersion from the update to allow us to check consistency.
        let op
        if (error != null) {
          return callback(error)
        }

        // Ensure that raw updates start where lastVersion left off
        if (lastVersion != null) {
          const discardedUpdates = []
          rawUpdates = rawUpdates.slice(0)
          while (rawUpdates[0] != null && rawUpdates[0].v <= lastVersion) {
            discardedUpdates.push(rawUpdates.shift())
          }
          if (discardedUpdates.length) {
            logger.error(
              { projectId, docId, discardedUpdates, temporary, lastVersion },
              'discarded updates already present'
            )
          }

          if (rawUpdates[0] != null && rawUpdates[0].v !== lastVersion + 1) {
            const ts = lastCompressedUpdate?.meta?.end_ts
            const lastTimestamp = ts != null ? new Date(ts) : 'unknown time'
            error = new Error(
              `Tried to apply raw op at version ${rawUpdates[0].v} to last compressed update with version ${lastVersion} from ${lastTimestamp}`
            )
            logger.error(
              {
                err: error,
                docId,
                projectId,
                prevEndTs: ts,
                temporary,
                lastCompressedUpdate,
              },
              'inconsistent doc versions'
            )
            if (
              (Settings.trackchanges != null
                ? Settings.trackchanges.continueOnError
                : undefined) &&
              rawUpdates[0].v > lastVersion + 1
            ) {
              // we have lost some ops - continue to write into the database, we can't recover at this point
              lastCompressedUpdate = null
            } else {
              return callback(error)
            }
          }
        }

        if (rawUpdates.length === 0) {
          return callback()
        }

        // some old large ops in redis need to be rejected, they predate
        // the size limit that now prevents them going through the system
        const REJECT_LARGE_OP_SIZE = 4 * 1024 * 1024
        for (const rawUpdate of Array.from(rawUpdates)) {
          const opSizes = (() => {
            const result = []
            for (op of Array.from(
              (rawUpdate != null ? rawUpdate.op : undefined) || []
            )) {
              result.push(
                (op.i != null ? op.i.length : undefined) ||
                  (op.d != null ? op.d.length : undefined)
              )
            }
            return result
          })()
          const size = _.max(opSizes)
          if (size > REJECT_LARGE_OP_SIZE) {
            error = new Error(
              `dropped op exceeding maximum allowed size of ${REJECT_LARGE_OP_SIZE}`
            )
            logger.error(
              { err: error, docId, projectId, size, rawUpdate },
              'dropped op - too big'
            )
            rawUpdate.op = []
          }
        }

        const compressedUpdates = UpdateCompressor.compressRawUpdates(
          null,
          rawUpdates
        )
        return PackManager.insertCompressedUpdates(
          projectId,
          docId,
          lastCompressedUpdate,
          compressedUpdates,
          temporary,
          function (error, result) {
            if (error != null) {
              return callback(error)
            }
            if (result != null) {
              logger.debug(
                {
                  projectId,
                  docId,
                  origV:
                    lastCompressedUpdate != null
                      ? lastCompressedUpdate.v
                      : undefined,
                  newV: result.v,
                },
                'inserted updates into pack'
              )
            }
            return callback()
          }
        )
      }
    )
  },

  // Check whether the updates are temporary (per-project property)
  _prepareProjectForUpdates(projectId, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return UpdateTrimmer.shouldTrimUpdates(
      projectId,
      function (error, temporary) {
        if (error != null) {
          return callback(error)
        }
        return callback(null, temporary)
      }
    )
  },

  // Check for project id on document history (per-document property)
  _prepareDocForUpdates(projectId, docId, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return MongoManager.backportProjectId(projectId, docId, function (error) {
      if (error != null) {
        return callback(error)
      }
      return callback(null)
    })
  },

  // Apply updates for specific project/doc after preparing at project and doc level
  REDIS_READ_BATCH_SIZE: 100,
  processUncompressedUpdates(projectId, docId, temporary, callback) {
    // get the updates as strings from redis (so we can delete them after they are applied)
    if (callback == null) {
      callback = function () {}
    }
    return RedisManager.getOldestDocUpdates(
      docId,
      UpdatesManager.REDIS_READ_BATCH_SIZE,
      function (error, docUpdates) {
        if (error != null) {
          return callback(error)
        }
        const { length } = docUpdates
        // parse the redis strings into ShareJs updates
        return RedisManager.expandDocUpdates(
          docUpdates,
          function (error, rawUpdates) {
            if (error != null) {
              logger.err(
                { projectId, docId, docUpdates },
                'failed to parse docUpdates'
              )
              return callback(error)
            }
            logger.debug(
              { projectId, docId, rawUpdates },
              'retrieved raw updates from redis'
            )
            return UpdatesManager.compressAndSaveRawUpdates(
              projectId,
              docId,
              rawUpdates,
              temporary,
              function (error) {
                if (error != null) {
                  return callback(error)
                }
                logger.debug(
                  { projectId, docId },
                  'compressed and saved doc updates'
                )
                // delete the applied updates from redis
                return RedisManager.deleteAppliedDocUpdates(
                  projectId,
                  docId,
                  docUpdates,
                  function (error) {
                    if (error != null) {
                      return callback(error)
                    }
                    if (length === UpdatesManager.REDIS_READ_BATCH_SIZE) {
                      // There might be more updates
                      logger.debug(
                        { projectId, docId },
                        'continuing processing updates'
                      )
                      return setTimeout(
                        () =>
                          UpdatesManager.processUncompressedUpdates(
                            projectId,
                            docId,
                            temporary,
                            callback
                          ),
                        0
                      )
                    } else {
                      logger.debug(
                        { projectId, docId },
                        'all raw updates processed'
                      )
                      return callback()
                    }
                  }
                )
              }
            )
          }
        )
      }
    )
  },

  // Process updates for a doc when we flush it individually
  processUncompressedUpdatesWithLock(projectId, docId, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return UpdatesManager._prepareProjectForUpdates(
      projectId,
      function (error, temporary) {
        if (error != null) {
          return callback(error)
        }
        return UpdatesManager._processUncompressedUpdatesForDocWithLock(
          projectId,
          docId,
          temporary,
          callback
        )
      }
    )
  },

  // Process updates for a doc when the whole project is flushed (internal method)
  _processUncompressedUpdatesForDocWithLock(
    projectId,
    docId,
    temporary,
    callback
  ) {
    if (callback == null) {
      callback = function () {}
    }
    return UpdatesManager._prepareDocForUpdates(
      projectId,
      docId,
      function (error) {
        if (error != null) {
          return callback(error)
        }
        return LockManager.runWithLock(
          keys.historyLock({ doc_id: docId }),
          releaseLock =>
            UpdatesManager.processUncompressedUpdates(
              projectId,
              docId,
              temporary,
              releaseLock
            ),
          callback
        )
      }
    )
  },

  // Process all updates for a project, only check project-level information once
  processUncompressedUpdatesForProject(projectId, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return RedisManager.getDocIdsWithHistoryOps(
      projectId,
      function (error, docIds) {
        if (error != null) {
          return callback(error)
        }
        return UpdatesManager._prepareProjectForUpdates(
          projectId,
          function (error, temporary) {
            if (error) return callback(error)
            const jobs = []
            for (const docId of Array.from(docIds)) {
              ;(docId =>
                jobs.push(cb =>
                  UpdatesManager._processUncompressedUpdatesForDocWithLock(
                    projectId,
                    docId,
                    temporary,
                    cb
                  )
                ))(docId)
            }
            return async.parallelLimit(jobs, 5, callback)
          }
        )
      }
    )
  },

  // flush all outstanding changes
  flushAll(limit, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return RedisManager.getProjectIdsWithHistoryOps(function (
      error,
      projectIds
    ) {
      let projectId
      if (error != null) {
        return callback(error)
      }
      logger.debug(
        {
          count: projectIds != null ? projectIds.length : undefined,
          projectIds,
        },
        'found projects'
      )
      const jobs = []
      projectIds = _.shuffle(projectIds) // randomise to avoid hitting same projects each time
      const selectedProjects =
        limit < 0 ? projectIds : projectIds.slice(0, limit)
      for (projectId of Array.from(selectedProjects)) {
        ;(projectId =>
          jobs.push(cb =>
            UpdatesManager.processUncompressedUpdatesForProject(
              projectId,
              err => cb(null, { failed: err != null, project_id: projectId })
            )
          ))(projectId)
      }
      return async.series(jobs, function (error, result) {
        let x
        if (error != null) {
          return callback(error)
        }
        const failedProjects = (() => {
          const result1 = []
          for (x of Array.from(result)) {
            if (x.failed) {
              result1.push(x.project_id)
            }
          }
          return result1
        })()
        const succeededProjects = (() => {
          const result2 = []
          for (x of Array.from(result)) {
            if (!x.failed) {
              result2.push(x.project_id)
            }
          }
          return result2
        })()
        return callback(null, {
          failed: failedProjects,
          succeeded: succeededProjects,
          all: projectIds,
        })
      })
    })
  },

  getDanglingUpdates(callback) {
    if (callback == null) {
      callback = function () {}
    }
    return RedisManager.getAllDocIdsWithHistoryOps(function (error, allDocIds) {
      if (error != null) {
        return callback(error)
      }
      return RedisManager.getProjectIdsWithHistoryOps(function (
        error,
        allProjectIds
      ) {
        if (error != null) {
          return callback(error)
        }
        // function to get doc_ids for each project
        const task = cb =>
          async.concatSeries(
            allProjectIds,
            RedisManager.getDocIdsWithHistoryOps,
            cb
          )
        // find the dangling doc ids
        return task(function (error, projectDocIds) {
          if (error) return callback(error)
          const danglingDocIds = _.difference(allDocIds, projectDocIds)
          logger.debug(
            { allDocIds, allProjectIds, projectDocIds, danglingDocIds },
            'checking for dangling doc ids'
          )
          return callback(null, danglingDocIds)
        })
      })
    })
  },

  getDocUpdates(projectId, docId, options, callback) {
    if (options == null) {
      options = {}
    }
    if (callback == null) {
      callback = function () {}
    }
    return UpdatesManager.processUncompressedUpdatesWithLock(
      projectId,
      docId,
      function (error) {
        if (error != null) {
          return callback(error)
        }
        // console.log "options", options
        return PackManager.getOpsByVersionRange(
          projectId,
          docId,
          options.from,
          options.to,
          function (error, updates) {
            if (error != null) {
              return callback(error)
            }
            return callback(null, updates)
          }
        )
      }
    )
  },

  getDocUpdatesWithUserInfo(projectId, docId, options, callback) {
    if (options == null) {
      options = {}
    }
    if (callback == null) {
      callback = function () {}
    }
    return UpdatesManager.getDocUpdates(
      projectId,
      docId,
      options,
      function (error, updates) {
        if (error != null) {
          return callback(error)
        }
        return UpdatesManager.fillUserInfo(updates, function (error, updates) {
          if (error != null) {
            return callback(error)
          }
          return callback(null, updates)
        })
      }
    )
  },

  getSummarizedProjectUpdates(projectId, options, callback) {
    if (options == null) {
      options = {}
    }
    if (callback == null) {
      callback = function () {}
    }
    if (!options.min_count) {
      options.min_count = 25
    }
    let summarizedUpdates = []
    const { before } = options
    let nextBeforeTimestamp = null
    return UpdatesManager.processUncompressedUpdatesForProject(
      projectId,
      function (error) {
        if (error != null) {
          return callback(error)
        }
        return PackManager.makeProjectIterator(
          projectId,
          before,
          function (err, iterator) {
            if (err != null) {
              return callback(err)
            }
            // repeatedly get updates and pass them through the summariser to get an final output with user info
            return async.whilst(
              cb =>
                // console.log "checking iterator.done", iterator.done()
                cb(
                  null,
                  summarizedUpdates.length < options.min_count &&
                    !iterator.done()
                ),
              cb =>
                iterator.next(function (err, partialUpdates) {
                  if (err != null) {
                    return callback(err)
                  }
                  // logger.log {partialUpdates}, 'got partialUpdates'
                  if (partialUpdates.length === 0) {
                    return cb()
                  } // # FIXME should try to avoid this happening
                  nextBeforeTimestamp =
                    partialUpdates[partialUpdates.length - 1].meta.end_ts
                  // add the updates to the summary list
                  summarizedUpdates = UpdatesManager._summarizeUpdates(
                    partialUpdates,
                    summarizedUpdates
                  )
                  return cb()
                }),

              () =>
                // finally done all updates
                // console.log 'summarized Updates', summarizedUpdates
                UpdatesManager.fillSummarizedUserInfo(
                  summarizedUpdates,
                  function (err, results) {
                    if (err != null) {
                      return callback(err)
                    }
                    return callback(
                      null,
                      results,
                      !iterator.done() ? nextBeforeTimestamp : undefined
                    )
                  }
                )
            )
          }
        )
      }
    )
  },

  exportProject(projectId, consumer) {
    // Flush anything before collecting updates.
    UpdatesManager.processUncompressedUpdatesForProject(projectId, err => {
      if (err) return consumer(err)

      // Fetch all the packs.
      const before = undefined
      PackManager.makeProjectIterator(projectId, before, (err, iterator) => {
        if (err) return consumer(err)

        const accumulatedUserIds = new Set()

        async.whilst(
          cb => cb(null, !iterator.done()),

          cb =>
            iterator.next((err, updatesFromASinglePack) => {
              if (err) return cb(err)

              if (updatesFromASinglePack.length === 0) {
                // This should not happen when `iterator.done() == false`.
                // Emitting an empty array would signal the consumer the final
                //  call.
                return cb()
              }
              updatesFromASinglePack.forEach(update => {
                accumulatedUserIds.add(
                  // Super defensive access on update details.
                  String(update && update.meta && update.meta.user_id)
                )
              })
              // Emit updates and wait for the consumer.
              consumer(null, { updates: updatesFromASinglePack }, cb)
            }),

          err => {
            if (err) return consumer(err)

            // Adding undefined can happen for broken updates.
            accumulatedUserIds.delete('undefined')

            consumer(null, {
              updates: [],
              userIds: Array.from(accumulatedUserIds).sort(),
            })
          }
        )
      })
    })
  },

  fetchUserInfo(users, callback) {
    if (callback == null) {
      callback = function () {}
    }
    const jobs = []
    const fetchedUserInfo = {}
    for (const userId in users) {
      ;(userId =>
        jobs.push(callback =>
          WebApiManager.getUserInfo(userId, function (error, userInfo) {
            if (error != null) {
              return callback(error)
            }
            fetchedUserInfo[userId] = userInfo
            return callback()
          })
        ))(userId)
    }

    return async.series(jobs, function (err) {
      if (err != null) {
        return callback(err)
      }
      return callback(null, fetchedUserInfo)
    })
  },

  fillUserInfo(updates, callback) {
    let update, userId
    if (callback == null) {
      callback = function () {}
    }
    const users = {}
    for (update of Array.from(updates)) {
      ;({ user_id: userId } = update.meta)
      if (UpdatesManager._validUserId(userId)) {
        users[userId] = true
      }
    }

    return UpdatesManager.fetchUserInfo(
      users,
      function (error, fetchedUserInfo) {
        if (error != null) {
          return callback(error)
        }
        for (update of Array.from(updates)) {
          ;({ user_id: userId } = update.meta)
          delete update.meta.user_id
          if (UpdatesManager._validUserId(userId)) {
            update.meta.user = fetchedUserInfo[userId]
          }
        }
        return callback(null, updates)
      }
    )
  },

  fillSummarizedUserInfo(updates, callback) {
    let update, userId, userIds
    if (callback == null) {
      callback = function () {}
    }
    const users = {}
    for (update of Array.from(updates)) {
      userIds = update.meta.user_ids || []
      for (userId of Array.from(userIds)) {
        if (UpdatesManager._validUserId(userId)) {
          users[userId] = true
        }
      }
    }

    return UpdatesManager.fetchUserInfo(
      users,
      function (error, fetchedUserInfo) {
        if (error != null) {
          return callback(error)
        }
        for (update of Array.from(updates)) {
          userIds = update.meta.user_ids || []
          update.meta.users = []
          delete update.meta.user_ids
          for (userId of Array.from(userIds)) {
            if (UpdatesManager._validUserId(userId)) {
              update.meta.users.push(fetchedUserInfo[userId])
            } else {
              update.meta.users.push(null)
            }
          }
        }
        return callback(null, updates)
      }
    )
  },

  _validUserId(userId) {
    if (userId == null) {
      return false
    } else {
      return !!userId.match(/^[a-f0-9]{24}$/)
    }
  },

  TIME_BETWEEN_DISTINCT_UPDATES: (fiveMinutes = 5 * 60 * 1000),
  SPLIT_ON_DELETE_SIZE: 16, // characters
  _summarizeUpdates(updates, existingSummarizedUpdates) {
    if (existingSummarizedUpdates == null) {
      existingSummarizedUpdates = []
    }
    const summarizedUpdates = existingSummarizedUpdates.slice()
    let previousUpdateWasBigDelete = false
    for (const update of Array.from(updates)) {
      let docId
      const earliestUpdate = summarizedUpdates[summarizedUpdates.length - 1]
      let shouldConcat = false

      // If a user inserts some text, then deletes a big chunk including that text,
      // the update we show might concat the insert and delete, and there will be no sign
      // of that insert having happened, or be able to restore to it (restoring after a big delete is common).
      // So, we split the summary on 'big' deletes. However, we've stepping backwards in time with
      // most recent changes considered first, so if this update is a big delete, we want to start
      // a new summarized update next timge, hence we monitor the previous update.
      if (previousUpdateWasBigDelete) {
        shouldConcat = false
      } else if (
        earliestUpdate &&
        earliestUpdate.meta.end_ts - update.meta.start_ts <
          this.TIME_BETWEEN_DISTINCT_UPDATES
      ) {
        // We're going backwards in time through the updates, so only combine if this update starts less than 5 minutes before
        // the end of current summarized block, so no block spans more than 5 minutes.
        shouldConcat = true
      }

      let isBigDelete = false
      for (const op of Array.from(update.op || [])) {
        if (op.d != null && op.d.length > this.SPLIT_ON_DELETE_SIZE) {
          isBigDelete = true
        }
      }

      previousUpdateWasBigDelete = isBigDelete

      if (shouldConcat) {
        // check if the user in this update is already present in the earliest update,
        // if not, add them to the users list of the earliest update
        earliestUpdate.meta.user_ids = _.union(earliestUpdate.meta.user_ids, [
          update.meta.user_id,
        ])

        docId = update.doc_id.toString()
        const doc = earliestUpdate.docs[docId]
        if (doc != null) {
          doc.fromV = Math.min(doc.fromV, update.v)
          doc.toV = Math.max(doc.toV, update.v)
        } else {
          earliestUpdate.docs[docId] = {
            fromV: update.v,
            toV: update.v,
          }
        }

        earliestUpdate.meta.start_ts = Math.min(
          earliestUpdate.meta.start_ts,
          update.meta.start_ts
        )
        earliestUpdate.meta.end_ts = Math.max(
          earliestUpdate.meta.end_ts,
          update.meta.end_ts
        )
      } else {
        const newUpdate = {
          meta: {
            user_ids: [],
            start_ts: update.meta.start_ts,
            end_ts: update.meta.end_ts,
          },
          docs: {},
        }

        newUpdate.docs[update.doc_id.toString()] = {
          fromV: update.v,
          toV: update.v,
        }
        newUpdate.meta.user_ids.push(update.meta.user_id)
        summarizedUpdates.push(newUpdate)
      }
    }

    return summarizedUpdates
  },
}

module.exports.promises = {
  processUncompressedUpdatesForProject: util.promisify(
    UpdatesManager.processUncompressedUpdatesForProject
  ),
}

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
