// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS201: Simplify complex destructure assignments
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import OError from '@overleaf/o-error'
import { db, ObjectId } from './mongodb.js'
import * as HistoryStoreManager from './HistoryStoreManager.js'
import * as UpdatesProcessor from './UpdatesProcessor.js'
import * as WebApiManager from './WebApiManager.js'

export function getLabels(projectId, callback) {
  return _toObjectId(projectId, function (error, projectId) {
    if (error != null) {
      return callback(OError.tag(error))
    }
    return db.projectHistoryLabels
      .find({ project_id: ObjectId(projectId) })
      .toArray(function (error, labels) {
        if (error != null) {
          return callback(OError.tag(error))
        }
        const formattedLabels = labels.map(_formatLabel)
        return callback(null, formattedLabels)
      })
  })
}

export function createLabel(
  projectId,
  userId,
  version,
  comment,
  createdAt,
  shouldValidateExists,
  callback
) {
  const validateVersionExists = function (callback) {
    if (shouldValidateExists === false) {
      return callback()
    } else {
      return _validateChunkExistsForVersion(
        projectId.toString(),
        version,
        callback
      )
    }
  }

  return _toObjectId(projectId, userId, function (error, projectId, userId) {
    if (error != null) {
      return callback(OError.tag(error))
    }
    return validateVersionExists(function (error) {
      if (error != null) {
        return callback(OError.tag(error))
      }

      createdAt = createdAt != null ? new Date(createdAt) : new Date()

      const label = {
        project_id: ObjectId(projectId),
        comment,
        version,
        user_id: ObjectId(userId),
        created_at: createdAt,
      }
      db.projectHistoryLabels.insertOne(label, function (error, confirmation) {
        if (error != null) {
          return callback(OError.tag(error))
        }
        label._id = confirmation.insertedId
        callback(null, _formatLabel(label))
      })
    })
  })
}

export function deleteLabel(projectId, userId, labelId, callback) {
  return _toObjectId(
    projectId,
    userId,
    labelId,
    function (error, projectId, userId, labelId) {
      if (error != null) {
        return callback(OError.tag(error))
      }
      return db.projectHistoryLabels.deleteOne(
        {
          _id: ObjectId(labelId),
          project_id: ObjectId(projectId),
          user_id: ObjectId(userId),
        },
        callback
      )
    }
  )
}

export function transferLabels(fromUserId, toUserId, callback) {
  return _toObjectId(
    fromUserId,
    toUserId,
    function (error, fromUserId, toUserId) {
      if (error != null) {
        return callback(OError.tag(error))
      }
      return db.projectHistoryLabels.updateMany(
        {
          user_id: fromUserId,
        },
        {
          $set: { user_id: toUserId },
        },
        callback
      )
    }
  )
}

function _toObjectId(...args1) {
  const adjustedLength = Math.max(args1.length, 1)
  const args = args1.slice(0, adjustedLength - 1)
  const callback = args1[adjustedLength - 1]
  try {
    const ids = args.map(ObjectId)
    return callback(null, ...Array.from(ids))
  } catch (error) {
    return callback(error)
  }
}

function _formatLabel(label) {
  return {
    id: label._id,
    comment: label.comment,
    version: label.version,
    user_id: label.user_id,
    created_at: label.created_at,
  }
}

function _validateChunkExistsForVersion(projectId, version, callback) {
  return UpdatesProcessor.processUpdatesForProject(projectId, function (error) {
    if (error != null) {
      return callback(error)
    }
    return WebApiManager.getHistoryId(projectId, function (error, historyId) {
      if (error != null) {
        return callback(error)
      }
      return HistoryStoreManager.getChunkAtVersion(
        projectId,
        historyId,
        version,
        function (error) {
          if (error != null) {
            return callback(error)
          }
          return callback()
        }
      )
    })
  })
}
