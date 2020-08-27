/* eslint-disable
    camelcase,
    handle-callback-err,
    max-len,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let ThreadManager
const { db, ObjectId } = require('../../mongodb')
const logger = require('logger-sharelatex')
const metrics = require('@overleaf/metrics')

module.exports = ThreadManager = {
  GLOBAL_THREAD: 'GLOBAL',

  findOrCreateThread(project_id, thread_id, callback) {
    let query, update
    if (callback == null) {
      callback = function (error, thread) {}
    }
    project_id = ObjectId(project_id.toString())
    if (thread_id !== ThreadManager.GLOBAL_THREAD) {
      thread_id = ObjectId(thread_id.toString())
    }

    if (thread_id === ThreadManager.GLOBAL_THREAD) {
      query = {
        project_id,
        thread_id: { $exists: false }
      }
      update = {
        project_id
      }
    } else {
      query = {
        project_id,
        thread_id
      }
      update = {
        project_id,
        thread_id
      }
    }

    db.rooms.updateOne(query, { $set: update }, { upsert: true }, function (
      error
    ) {
      if (error != null) {
        return callback(error)
      }
      db.rooms.findOne(query, callback)
    })
  },

  findAllThreadRooms(project_id, callback) {
    if (callback == null) {
      callback = function (error, rooms) {}
    }
    db.rooms
      .find(
        {
          project_id: ObjectId(project_id.toString()),
          thread_id: { $exists: true }
        },
        {
          thread_id: 1,
          resolved: 1
        }
      )
      .toArray(callback)
  },

  resolveThread(project_id, thread_id, user_id, callback) {
    if (callback == null) {
      callback = function (error) {}
    }
    db.rooms.updateOne(
      {
        project_id: ObjectId(project_id.toString()),
        thread_id: ObjectId(thread_id.toString())
      },
      {
        $set: {
          resolved: {
            user_id,
            ts: new Date()
          }
        }
      },
      callback
    )
  },

  reopenThread(project_id, thread_id, callback) {
    if (callback == null) {
      callback = function (error) {}
    }
    db.rooms.updateOne(
      {
        project_id: ObjectId(project_id.toString()),
        thread_id: ObjectId(thread_id.toString())
      },
      {
        $unset: {
          resolved: true
        }
      },
      callback
    )
  },

  deleteThread(project_id, thread_id, callback) {
    if (callback == null) {
      callback = function (error, room_id) {}
    }
    return this.findOrCreateThread(project_id, thread_id, function (
      error,
      room
    ) {
      if (error != null) {
        return callback(error)
      }
      db.rooms.deleteOne(
        {
          _id: room._id
        },
        function (error) {
          if (error != null) {
            return callback(error)
          }
          return callback(null, room._id)
        }
      )
    })
  }
}
;[
  'findOrCreateThread',
  'findAllThreadRooms',
  'resolveThread',
  'reopenThread',
  'deleteThread'
].map((method) =>
  metrics.timeAsyncMethod(ThreadManager, method, 'mongo.ThreadManager', logger)
)
