/* eslint-disable
    camelcase,
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
  compressAndSaveRawUpdates(
    project_id,
    doc_id,
    rawUpdates,
    temporary,
    callback
  ) {
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
        const prevVersion = __guard__(rawUpdates[i - 1], x => x.v)
        if (!(prevVersion < thisVersion)) {
          logger.error(
            {
              project_id,
              doc_id,
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
      doc_id,
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
              { project_id, doc_id, discardedUpdates, temporary, lastVersion },
              'discarded updates already present'
            )
          }

          if (rawUpdates[0] != null && rawUpdates[0].v !== lastVersion + 1) {
            const ts = __guard__(
              lastCompressedUpdate != null
                ? lastCompressedUpdate.meta
                : undefined,
              x1 => x1.end_ts
            )
            const last_timestamp = ts != null ? new Date(ts) : 'unknown time'
            error = new Error(
              `Tried to apply raw op at version ${rawUpdates[0].v} to last compressed update with version ${lastVersion} from ${last_timestamp}`
            )
            logger.error(
              {
                err: error,
                doc_id,
                project_id,
                prev_end_ts: ts,
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
              { err: error, doc_id, project_id, size, rawUpdate },
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
          project_id,
          doc_id,
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
                  project_id,
                  doc_id,
                  orig_v:
                    lastCompressedUpdate != null
                      ? lastCompressedUpdate.v
                      : undefined,
                  new_v: result.v,
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
  _prepareProjectForUpdates(project_id, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return UpdateTrimmer.shouldTrimUpdates(
      project_id,
      function (error, temporary) {
        if (error != null) {
          return callback(error)
        }
        return callback(null, temporary)
      }
    )
  },

  // Check for project id on document history (per-document property)
  _prepareDocForUpdates(project_id, doc_id, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return MongoManager.backportProjectId(project_id, doc_id, function (error) {
      if (error != null) {
        return callback(error)
      }
      return callback(null)
    })
  },

  // Apply updates for specific project/doc after preparing at project and doc level
  REDIS_READ_BATCH_SIZE: 100,
  processUncompressedUpdates(project_id, doc_id, temporary, callback) {
    // get the updates as strings from redis (so we can delete them after they are applied)
    if (callback == null) {
      callback = function () {}
    }
    return RedisManager.getOldestDocUpdates(
      doc_id,
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
                { project_id, doc_id, docUpdates },
                'failed to parse docUpdates'
              )
              return callback(error)
            }
            logger.debug(
              { project_id, doc_id, rawUpdates },
              'retrieved raw updates from redis'
            )
            return UpdatesManager.compressAndSaveRawUpdates(
              project_id,
              doc_id,
              rawUpdates,
              temporary,
              function (error) {
                if (error != null) {
                  return callback(error)
                }
                logger.debug(
                  { project_id, doc_id },
                  'compressed and saved doc updates'
                )
                // delete the applied updates from redis
                return RedisManager.deleteAppliedDocUpdates(
                  project_id,
                  doc_id,
                  docUpdates,
                  function (error) {
                    if (error != null) {
                      return callback(error)
                    }
                    if (length === UpdatesManager.REDIS_READ_BATCH_SIZE) {
                      // There might be more updates
                      logger.debug(
                        { project_id, doc_id },
                        'continuing processing updates'
                      )
                      return setTimeout(
                        () =>
                          UpdatesManager.processUncompressedUpdates(
                            project_id,
                            doc_id,
                            temporary,
                            callback
                          ),
                        0
                      )
                    } else {
                      logger.debug(
                        { project_id, doc_id },
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
  processUncompressedUpdatesWithLock(project_id, doc_id, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return UpdatesManager._prepareProjectForUpdates(
      project_id,
      function (error, temporary) {
        if (error != null) {
          return callback(error)
        }
        return UpdatesManager._processUncompressedUpdatesForDocWithLock(
          project_id,
          doc_id,
          temporary,
          callback
        )
      }
    )
  },

  // Process updates for a doc when the whole project is flushed (internal method)
  _processUncompressedUpdatesForDocWithLock(
    project_id,
    doc_id,
    temporary,
    callback
  ) {
    if (callback == null) {
      callback = function () {}
    }
    return UpdatesManager._prepareDocForUpdates(
      project_id,
      doc_id,
      function (error) {
        if (error != null) {
          return callback(error)
        }
        return LockManager.runWithLock(
          keys.historyLock({ doc_id }),
          releaseLock =>
            UpdatesManager.processUncompressedUpdates(
              project_id,
              doc_id,
              temporary,
              releaseLock
            ),
          callback
        )
      }
    )
  },

  // Process all updates for a project, only check project-level information once
  processUncompressedUpdatesForProject(project_id, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return RedisManager.getDocIdsWithHistoryOps(
      project_id,
      function (error, doc_ids) {
        if (error != null) {
          return callback(error)
        }
        return UpdatesManager._prepareProjectForUpdates(
          project_id,
          function (error, temporary) {
            if (error) return callback(error)
            const jobs = []
            for (const doc_id of Array.from(doc_ids)) {
              ;(doc_id =>
                jobs.push(cb =>
                  UpdatesManager._processUncompressedUpdatesForDocWithLock(
                    project_id,
                    doc_id,
                    temporary,
                    cb
                  )
                ))(doc_id)
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
      project_ids
    ) {
      let project_id
      if (error != null) {
        return callback(error)
      }
      logger.debug(
        {
          count: project_ids != null ? project_ids.length : undefined,
          project_ids,
        },
        'found projects'
      )
      const jobs = []
      project_ids = _.shuffle(project_ids) // randomise to avoid hitting same projects each time
      const selectedProjects =
        limit < 0 ? project_ids : project_ids.slice(0, limit)
      for (project_id of Array.from(selectedProjects)) {
        ;(project_id =>
          jobs.push(cb =>
            UpdatesManager.processUncompressedUpdatesForProject(
              project_id,
              err => cb(null, { failed: err != null, project_id })
            )
          ))(project_id)
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
          all: project_ids,
        })
      })
    })
  },

  getDanglingUpdates(callback) {
    if (callback == null) {
      callback = function () {}
    }
    return RedisManager.getAllDocIdsWithHistoryOps(function (
      error,
      all_doc_ids
    ) {
      if (error != null) {
        return callback(error)
      }
      return RedisManager.getProjectIdsWithHistoryOps(function (
        error,
        all_project_ids
      ) {
        if (error != null) {
          return callback(error)
        }
        // function to get doc_ids for each project
        const task = cb =>
          async.concatSeries(
            all_project_ids,
            RedisManager.getDocIdsWithHistoryOps,
            cb
          )
        // find the dangling doc ids
        return task(function (error, project_doc_ids) {
          if (error) return callback(error)
          const dangling_doc_ids = _.difference(all_doc_ids, project_doc_ids)
          logger.debug(
            { all_doc_ids, all_project_ids, project_doc_ids, dangling_doc_ids },
            'checking for dangling doc ids'
          )
          return callback(null, dangling_doc_ids)
        })
      })
    })
  },

  getDocUpdates(project_id, doc_id, options, callback) {
    if (options == null) {
      options = {}
    }
    if (callback == null) {
      callback = function () {}
    }
    return UpdatesManager.processUncompressedUpdatesWithLock(
      project_id,
      doc_id,
      function (error) {
        if (error != null) {
          return callback(error)
        }
        // console.log "options", options
        return PackManager.getOpsByVersionRange(
          project_id,
          doc_id,
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

  getDocUpdatesWithUserInfo(project_id, doc_id, options, callback) {
    if (options == null) {
      options = {}
    }
    if (callback == null) {
      callback = function () {}
    }
    return UpdatesManager.getDocUpdates(
      project_id,
      doc_id,
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

  getSummarizedProjectUpdates(project_id, options, callback) {
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
      project_id,
      function (error) {
        if (error != null) {
          return callback(error)
        }
        return PackManager.makeProjectIterator(
          project_id,
          before,
          function (err, iterator) {
            if (err != null) {
              return callback(err)
            }
            // repeatedly get updates and pass them through the summariser to get an final output with user info
            return async.whilst(
              () =>
                // console.log "checking iterator.done", iterator.done()
                summarizedUpdates.length < options.min_count &&
                !iterator.done(),

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
          () => !iterator.done(),

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
    for (const user_id in users) {
      ;(user_id =>
        jobs.push(callback =>
          WebApiManager.getUserInfo(user_id, function (error, userInfo) {
            if (error != null) {
              return callback(error)
            }
            fetchedUserInfo[user_id] = userInfo
            return callback()
          })
        ))(user_id)
    }

    return async.series(jobs, function (err) {
      if (err != null) {
        return callback(err)
      }
      return callback(null, fetchedUserInfo)
    })
  },

  fillUserInfo(updates, callback) {
    let update, user_id
    if (callback == null) {
      callback = function () {}
    }
    const users = {}
    for (update of Array.from(updates)) {
      ;({ user_id } = update.meta)
      if (UpdatesManager._validUserId(user_id)) {
        users[user_id] = true
      }
    }

    return UpdatesManager.fetchUserInfo(
      users,
      function (error, fetchedUserInfo) {
        if (error != null) {
          return callback(error)
        }
        for (update of Array.from(updates)) {
          ;({ user_id } = update.meta)
          delete update.meta.user_id
          if (UpdatesManager._validUserId(user_id)) {
            update.meta.user = fetchedUserInfo[user_id]
          }
        }
        return callback(null, updates)
      }
    )
  },

  fillSummarizedUserInfo(updates, callback) {
    let update, user_id, user_ids
    if (callback == null) {
      callback = function () {}
    }
    const users = {}
    for (update of Array.from(updates)) {
      user_ids = update.meta.user_ids || []
      for (user_id of Array.from(user_ids)) {
        if (UpdatesManager._validUserId(user_id)) {
          users[user_id] = true
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
          user_ids = update.meta.user_ids || []
          update.meta.users = []
          delete update.meta.user_ids
          for (user_id of Array.from(user_ids)) {
            if (UpdatesManager._validUserId(user_id)) {
              update.meta.users.push(fetchedUserInfo[user_id])
            } else {
              update.meta.users.push(null)
            }
          }
        }
        return callback(null, updates)
      }
    )
  },

  _validUserId(user_id) {
    if (user_id == null) {
      return false
    } else {
      return !!user_id.match(/^[a-f0-9]{24}$/)
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
      let doc_id
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

        doc_id = update.doc_id.toString()
        const doc = earliestUpdate.docs[doc_id]
        if (doc != null) {
          doc.fromV = Math.min(doc.fromV, update.v)
          doc.toV = Math.max(doc.toV, update.v)
        } else {
          earliestUpdate.docs[doc_id] = {
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
