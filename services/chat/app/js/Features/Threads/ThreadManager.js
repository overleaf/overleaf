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
const mongojs = require('../../mongojs')
const { db } = mongojs
const { ObjectId } = mongojs
const logger = require('logger-sharelatex')
const metrics = require('metrics-sharelatex')

module.exports = ThreadManager = {
  GLOBAL_THREAD: 'GLOBAL',

  findOrCreateThread(project_id, thread_id, callback) {
    let query, update
    if (callback == null) {
      callback = function(error, thread) {}
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

    return db.rooms.update(query, {'$set' : update}, { upsert: true }, function(error) {
      if (error != null) {
        return callback(error)
      }
      return db.rooms.find(query, function(error, rooms) {
        if (rooms == null) {
          rooms = []
        }
        if (error != null) {
          return callback(error)
        }
        return callback(null, rooms[0])
      })
    })
  },

  findAllThreadRooms(project_id, callback) {
    if (callback == null) {
      callback = function(error, rooms) {}
    }
    return db.rooms.find(
      {
        project_id: ObjectId(project_id.toString()),
        thread_id: { $exists: true }
      },
      {
        thread_id: 1,
        resolved: 1
      },
      callback
    )
  },

  resolveThread(project_id, thread_id, user_id, callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    return db.rooms.update(
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
      callback = function(error) {}
    }
    return db.rooms.update(
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
      callback = function(error, room_id) {}
    }
    return this.findOrCreateThread(project_id, thread_id, function(
      error,
      room
    ) {
      if (error != null) {
        return callback(error)
      }
      return db.rooms.remove(
        {
          _id: room._id
        },
        function(error) {
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
].map(method =>
  metrics.timeAsyncMethod(ThreadManager, method, 'mongo.ThreadManager', logger)
)
