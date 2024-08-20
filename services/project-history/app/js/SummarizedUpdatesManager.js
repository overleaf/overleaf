import _ from 'lodash'
import async from 'async'
import logger from '@overleaf/logger'
import OError from '@overleaf/o-error'
import * as ChunkTranslator from './ChunkTranslator.js'
import * as HistoryApiManager from './HistoryApiManager.js'
import * as HistoryStoreManager from './HistoryStoreManager.js'
import * as LabelsManager from './LabelsManager.js'
import * as UpdatesProcessor from './UpdatesProcessor.js'
import * as WebApiManager from './WebApiManager.js'

const MAX_CHUNK_REQUESTS = 5
const TIME_BETWEEN_DISTINCT_UPDATES = 5 * 60 * 1000 // five minutes

export function getSummarizedProjectUpdates(projectId, options, callback) {
  // Some notes on versions:
  //
  // Versions of the project are like the fenceposts between updates.
  // An update applies to a certain version of the project, and gives us the
  // next version.
  //
  // When we ask for updates 'before' a version, this includes the update
  // that created the version equal to 'before'.
  //
  // A chunk in OL has a 'startVersion', which is the version of the project
  // before any of the updates in it were applied. This is the same version as
  // the last update in the previous chunk would have created.
  //
  // If we ask the OL history store for the chunk with version that is the end of one
  // chunk and the start of another, it will return the older chunk, i.e.
  // the chunk with the updates that led up to that version.
  //
  // So once we read in the updates from a chunk, and want to get the updates from
  // the previous chunk, we ask OL for the chunk with the version equal to the
  // 'startVersion' of the newer chunk we just read.

  let nextVersionToRequest
  if (options == null) {
    options = {}
  }
  if (!options.min_count) {
    options.min_count = 25
  }
  if (options.before != null) {
    // The version is of the doc, so we want the updates before that version,
    // which includes the update that created that version.
    nextVersionToRequest = options.before
  } else {
    // Return the latest updates first if no nextVersionToRequest is set.
    nextVersionToRequest = null
  }

  UpdatesProcessor.processUpdatesForProject(projectId, function (error) {
    if (error) {
      return callback(OError.tag(error))
    }
    LabelsManager.getLabels(projectId, function (error, labels) {
      if (error) {
        return callback(OError.tag(error))
      }

      const labelsByVersion = {}
      for (const label of labels) {
        if (labelsByVersion[label.version] == null) {
          labelsByVersion[label.version] = []
        }
        labelsByVersion[label.version].push(label)
      }

      WebApiManager.getHistoryId(projectId, function (error, historyId) {
        if (error) return callback(error)
        let chunksRequested = 0
        let summarizedUpdates = []
        let toV = null

        const shouldRequestMoreUpdates = cb => {
          return cb(
            null,
            chunksRequested < MAX_CHUNK_REQUESTS &&
              (nextVersionToRequest == null || nextVersionToRequest > 0) &&
              summarizedUpdates.length < options.min_count
          )
        }

        const getNextBatchOfUpdates = cb =>
          _getProjectUpdates(
            projectId,
            historyId,
            nextVersionToRequest,
            function (error, updateSet, startVersion) {
              if (error) {
                return cb(OError.tag(error))
              }
              // Updates are returned in time order, but we want to go back in time
              updateSet.reverse()
              updateSet = discardUnwantedUpdates(updateSet)
              ;({ summarizedUpdates, toV } = _summarizeUpdates(
                updateSet,
                labelsByVersion,
                summarizedUpdates,
                toV
              ))
              nextVersionToRequest = startVersion
              chunksRequested += 1
              cb()
            }
          )

        function discardUnwantedUpdates(updateSet) {
          // We're getting whole chunks from the OL history store, but we might
          // only want updates from before a certain version
          if (options.before == null) {
            return updateSet
          } else {
            return updateSet.filter(u => u.v < options.before)
          }
        }

        // If the project doesn't have a history then we can bail out here
        HistoryApiManager.shouldUseProjectHistory(
          projectId,
          function (error, shouldUseProjectHistory) {
            if (error) {
              return callback(OError.tag(error))
            }
            if (shouldUseProjectHistory) {
              async.whilst(
                shouldRequestMoreUpdates,
                getNextBatchOfUpdates,
                function (error) {
                  if (error) {
                    return callback(OError.tag(error))
                  }
                  callback(
                    null,
                    summarizedUpdates,
                    nextVersionToRequest > 0 ? nextVersionToRequest : undefined
                  )
                }
              )
            } else {
              logger.debug(
                { projectId },
                'returning no updates as project does not use history'
              )
              callback(null, [])
            }
          }
        )
      })
    })
  })
}

function _getProjectUpdates(projectId, historyId, version, callback) {
  function getChunk(cb) {
    if (version != null) {
      HistoryStoreManager.getChunkAtVersion(projectId, historyId, version, cb)
    } else {
      HistoryStoreManager.getMostRecentChunk(projectId, historyId, cb)
    }
  }

  getChunk(function (error, chunk) {
    if (error) {
      return callback(OError.tag(error))
    }
    const oldestVersion = chunk.chunk.startVersion
    ChunkTranslator.convertToSummarizedUpdates(
      chunk,
      function (error, updateSet) {
        if (error) {
          return callback(OError.tag(error))
        }
        callback(error, updateSet, oldestVersion)
      }
    )
  })
}

function _summarizeUpdates(updates, labels, existingSummarizedUpdates, toV) {
  if (existingSummarizedUpdates == null) {
    existingSummarizedUpdates = []
  }
  const summarizedUpdates = existingSummarizedUpdates.slice()
  for (const update of updates) {
    if (toV == null) {
      // This is the first update we've seen. Initialize toV.
      toV = update.v + 1
    }

    // Skip empty updates (only record their version). Empty updates are
    // updates that only contain comment operations. We don't have a UI for
    // these yet.
    if (isUpdateEmpty(update)) {
      continue
    }

    // The client needs to know the exact version that a delete happened, in order
    // to be able to restore. So even when summarizing, retain the version that each
    // projectOp happened at.
    for (const projectOp of update.project_ops) {
      projectOp.atV = update.v
    }

    const summarizedUpdate = summarizedUpdates[summarizedUpdates.length - 1]
    const labelsForVersion = labels[update.v + 1] || []
    if (
      summarizedUpdate &&
      _shouldMergeUpdate(update, summarizedUpdate, labelsForVersion)
    ) {
      _mergeUpdate(update, summarizedUpdate)
    } else {
      const newUpdate = {
        fromV: update.v,
        toV,
        meta: {
          users: update.meta.users,
          start_ts: update.meta.start_ts,
          end_ts: update.meta.end_ts,
        },
        labels: labelsForVersion,
        pathnames: new Set(update.pathnames),
        project_ops: update.project_ops.slice(), // Clone since we'll modify
      }
      if (update.meta.origin) {
        newUpdate.meta.origin = update.meta.origin
      }

      summarizedUpdates.push(newUpdate)
    }
    toV = update.v
  }

  return { summarizedUpdates, toV }
}

/**
 * Given an update, the latest summarized update, and the labels that apply to
 * the update, figure out if we can merge the update into the summarized
 * update.
 */
function _shouldMergeUpdate(update, summarizedUpdate, labels) {
  // Split updates on labels
  if (labels.length > 0) {
    return false
  }

  // Split updates on origin
  if (update.meta.origin) {
    if (summarizedUpdate.meta.origin) {
      if (update.meta.origin.kind !== summarizedUpdate.meta.origin.kind) {
        return false
      }
      if (update.meta.origin.path !== summarizedUpdate.meta.origin.path) {
        return false
      }
      if (
        update.meta.origin.kind === 'file-restore' &&
        update.meta.origin.timestamp !== summarizedUpdate.meta.origin.timestamp
      ) {
        return false
      }
      if (
        update.meta.origin.kind === 'project-restore' &&
        update.meta.origin.timestamp !== summarizedUpdate.meta.origin.timestamp
      ) {
        return false
      }
    } else {
      return false
    }
  } else if (summarizedUpdate.meta.origin) {
    return false
  }

  // Split updates if it's been too long since the last update.  We're going
  // backwards in time through the updates, so the update comes before the summarized update.
  if (
    summarizedUpdate.meta.end_ts - update.meta.start_ts >=
    TIME_BETWEEN_DISTINCT_UPDATES
  ) {
    return false
  }

  // Do not merge text operations and file operations, except for history resyncs
  const updateHasTextOps = update.pathnames.length > 0
  const updateHasFileOps = update.project_ops.length > 0
  const summarizedUpdateHasTextOps = summarizedUpdate.pathnames.size > 0
  const summarizedUpdateHasFileOps = summarizedUpdate.project_ops.length > 0
  const isHistoryResync =
    update.meta.origin &&
    ['history-resync', 'history-migration'].includes(update.meta.origin.kind)
  if (
    !isHistoryResync &&
    ((updateHasTextOps && summarizedUpdateHasFileOps) ||
      (updateHasFileOps && summarizedUpdateHasTextOps))
  ) {
    return false
  }

  return true
}

/**
 * Merge an update into a summarized update.
 *
 * This mutates the summarized update.
 */
function _mergeUpdate(update, summarizedUpdate) {
  // check if the user in this update is already present in the earliest update,
  // if not, add them to the users list of the earliest update
  summarizedUpdate.meta.users = _.uniqBy(
    _.union(summarizedUpdate.meta.users, update.meta.users),
    function (user) {
      if (user == null) {
        return null
      }
      if (user.id == null) {
        return user
      }
      return user.id
    }
  )

  summarizedUpdate.fromV = Math.min(summarizedUpdate.fromV, update.v)
  summarizedUpdate.toV = Math.max(summarizedUpdate.toV, update.v + 1)
  summarizedUpdate.meta.start_ts = Math.min(
    summarizedUpdate.meta.start_ts,
    update.meta.start_ts
  )
  summarizedUpdate.meta.end_ts = Math.max(
    summarizedUpdate.meta.end_ts,
    update.meta.end_ts
  )

  // Add file operations
  for (const op of update.project_ops || []) {
    summarizedUpdate.project_ops.push(op)
    if (op.add) {
      // Merging a file creation. Remove any corresponding edit since that's redundant.
      summarizedUpdate.pathnames.delete(op.add.pathname)
    }
  }

  // Add edit operations
  for (const pathname of update.pathnames || []) {
    summarizedUpdate.pathnames.add(pathname)
  }
}

function isUpdateEmpty(update) {
  return update.project_ops.length === 0 && update.pathnames.length === 0
}
