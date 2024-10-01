import OError from '@overleaf/o-error'
import { db, ObjectId } from './mongodb.js'
import * as HistoryStoreManager from './HistoryStoreManager.js'
import * as UpdatesProcessor from './UpdatesProcessor.js'
import * as WebApiManager from './WebApiManager.js'

export function getLabels(projectId, callback) {
  _toObjectId(projectId, function (error, projectId) {
    if (error) {
      return callback(OError.tag(error))
    }
    db.projectHistoryLabels
      .find({ project_id: new ObjectId(projectId) })
      .toArray(function (error, labels) {
        if (error) {
          return callback(OError.tag(error))
        }
        const formattedLabels = labels.map(_formatLabel)
        callback(null, formattedLabels)
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
      callback()
    } else {
      _validateChunkExistsForVersion(projectId.toString(), version, callback)
    }
  }

  _toObjectId(projectId, userId, function (error, projectId, userId) {
    if (error) {
      return callback(OError.tag(error))
    }
    validateVersionExists(function (error) {
      if (error) {
        return callback(OError.tag(error))
      }

      createdAt = createdAt != null ? new Date(createdAt) : new Date()

      const label = {
        project_id: new ObjectId(projectId),
        comment,
        version,
        created_at: createdAt,
      }
      if (userId) {
        label.user_id = userId
      }
      db.projectHistoryLabels.insertOne(label, function (error, confirmation) {
        if (error) {
          return callback(OError.tag(error))
        }
        label._id = confirmation.insertedId
        callback(null, _formatLabel(label))
      })
    })
  })
}

export function deleteLabelForUser(projectId, userId, labelId, callback) {
  _toObjectId(
    projectId,
    userId,
    labelId,
    function (error, projectId, userId, labelId) {
      if (error) {
        return callback(OError.tag(error))
      }
      db.projectHistoryLabels.deleteOne(
        {
          _id: new ObjectId(labelId),
          project_id: new ObjectId(projectId),
          user_id: new ObjectId(userId),
        },
        callback
      )
    }
  )
}

export function deleteLabel(projectId, labelId, callback) {
  _toObjectId(projectId, labelId, function (error, projectId, labelId) {
    if (error) {
      return callback(OError.tag(error))
    }
    db.projectHistoryLabels.deleteOne(
      {
        _id: new ObjectId(labelId),
        project_id: new ObjectId(projectId),
      },
      callback
    )
  })
}

export function transferLabels(fromUserId, toUserId, callback) {
  _toObjectId(fromUserId, toUserId, function (error, fromUserId, toUserId) {
    if (error) {
      return callback(OError.tag(error))
    }
    db.projectHistoryLabels.updateMany(
      {
        user_id: fromUserId,
      },
      {
        $set: { user_id: toUserId },
      },
      callback
    )
  })
}

function _toObjectId(...args1) {
  const adjustedLength = Math.max(args1.length, 1)
  const args = args1.slice(0, adjustedLength - 1)
  const callback = args1[adjustedLength - 1]
  try {
    const ids = args.map(id => {
      if (id) {
        return new ObjectId(id)
      } else {
        return undefined
      }
    })
    callback(null, ...ids)
  } catch (error) {
    callback(error)
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
  UpdatesProcessor.processUpdatesForProject(projectId, function (error) {
    if (error) {
      return callback(error)
    }
    WebApiManager.getHistoryId(projectId, function (error, historyId) {
      if (error) {
        return callback(error)
      }
      HistoryStoreManager.getChunkAtVersion(
        projectId,
        historyId,
        version,
        function (error) {
          if (error) {
            return callback(error)
          }
          callback()
        }
      )
    })
  })
}
