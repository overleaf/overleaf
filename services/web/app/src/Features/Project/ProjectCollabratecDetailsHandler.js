/* eslint-disable
    n/handle-callback-err,
    max-len,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let ProjectCollabratecDetailsHandler
const { ObjectId } = require('mongodb')
const { Project } = require('../../models/Project')

module.exports = ProjectCollabratecDetailsHandler = {
  initializeCollabratecProject(
    projectId,
    userId,
    collabratecDocumentId,
    collabratecPrivategroupId,
    callback
  ) {
    if (callback == null) {
      callback = function () {}
    }
    ProjectCollabratecDetailsHandler.setCollabratecUsers(
      projectId,
      [
        {
          user_id: userId,
          collabratec_document_id: collabratecDocumentId,
          collabratec_privategroup_id: collabratecPrivategroupId,
        },
      ],
      callback
    )
  },

  isLinkedCollabratecUserProject(projectId, userId, callback) {
    if (callback == null) {
      callback = function () {}
    }
    try {
      projectId = ObjectId(projectId)
      userId = ObjectId(userId)
    } catch (error) {
      const err = error
      return callback(err)
    }
    const query = {
      _id: projectId,
      collabratecUsers: {
        $elemMatch: {
          user_id: userId,
        },
      },
    }
    Project.findOne(query, { _id: 1 }, function (err, project) {
      if (err != null) {
        callback(err)
      }
      callback(null, project != null)
    })
  },

  linkCollabratecUserProject(
    projectId,
    userId,
    collabratecDocumentId,
    callback
  ) {
    if (callback == null) {
      callback = function () {}
    }
    try {
      projectId = ObjectId(projectId)
      userId = ObjectId(userId)
    } catch (error) {
      const err = error
      return callback(err)
    }
    const query = {
      _id: projectId,
      collabratecUsers: {
        $not: {
          $elemMatch: {
            collabratec_document_id: collabratecDocumentId,
            user_id: userId,
          },
        },
      },
    }
    const update = {
      $push: {
        collabratecUsers: {
          collabratec_document_id: collabratecDocumentId,
          user_id: userId,
        },
      },
    }
    Project.updateOne(query, update, callback)
  },

  setCollabratecUsers(projectId, collabratecUsers, callback) {
    let err
    if (callback == null) {
      callback = function () {}
    }
    try {
      projectId = ObjectId(projectId)
    } catch (error) {
      err = error
      return callback(err)
    }
    if (!Array.isArray(collabratecUsers)) {
      callback(new Error('collabratec_users must be array'))
    }
    for (const collabratecUser of Array.from(collabratecUsers)) {
      try {
        collabratecUser.user_id = ObjectId(collabratecUser.user_id)
      } catch (error1) {
        err = error1
        return callback(err)
      }
    }
    const update = { $set: { collabratecUsers } }
    Project.updateOne({ _id: projectId }, update, callback)
  },

  unlinkCollabratecUserProject(projectId, userId, callback) {
    if (callback == null) {
      callback = function () {}
    }
    try {
      projectId = ObjectId(projectId)
      userId = ObjectId(userId)
    } catch (error) {
      const err = error
      return callback(err)
    }
    const query = { _id: projectId }
    const update = {
      $pull: {
        collabratecUsers: {
          user_id: userId,
        },
      },
    }
    Project.updateOne(query, update, callback)
  },

  updateCollabratecUserIds(oldUserId, newUserId, callback) {
    if (callback == null) {
      callback = function () {}
    }
    try {
      oldUserId = ObjectId(oldUserId)
      newUserId = ObjectId(newUserId)
    } catch (error) {
      const err = error
      return callback(err)
    }
    const query = { 'collabratecUsers.user_id': oldUserId }
    const update = { $set: { 'collabratecUsers.$.user_id': newUserId } }
    Project.updateMany(query, update, callback)
  },
}
