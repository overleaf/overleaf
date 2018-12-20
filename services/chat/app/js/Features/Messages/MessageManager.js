/* eslint-disable
    camelcase,
    handle-callback-err,
    max-len,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let MessageManager
const mongojs = require('../../mongojs')
const { db } = mongojs
const { ObjectId } = mongojs
const async = require('async')
const metrics = require('metrics-sharelatex')
const logger = require('logger-sharelatex')

module.exports = MessageManager = {
  createMessage(room_id, user_id, content, timestamp, callback) {
    if (callback == null) {
      callback = function(error, message) {}
    }
    let newMessageOpts = {
      content,
      room_id,
      user_id,
      timestamp
    }
    newMessageOpts = this._ensureIdsAreObjectIds(newMessageOpts)
    return db.messages.save(newMessageOpts, callback)
  },

  getMessages(room_id, limit, before, callback) {
    if (callback == null) {
      callback = function(error, messages) {}
    }
    let query = { room_id }
    if (before != null) {
      query.timestamp = { $lt: before }
    }
    query = this._ensureIdsAreObjectIds(query)
    const cursor = db.messages
      .find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
    return cursor.toArray(callback)
  },

  findAllMessagesInRooms(room_ids, callback) {
    if (callback == null) {
      callback = function(error, messages) {}
    }
    return db.messages.find(
      {
        room_id: { $in: room_ids }
      },
      callback
    )
  },

  deleteAllMessagesInRoom(room_id, callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    return db.messages.remove(
      {
        room_id
      },
      callback
    )
  },

  updateMessage(room_id, message_id, content, timestamp, callback) {
    if (callback == null) {
      callback = function(error, message) {}
    }
    const query = this._ensureIdsAreObjectIds({
      _id: message_id,
      room_id
    })
    return db.messages.update(
      query,
      {
        $set: {
          content,
          edited_at: timestamp
        }
      },
      function(error) {
        if (error != null) {
          return callback(error)
        }
        return callback()
      }
    )
  },

  deleteMessage(room_id, message_id, callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    const query = this._ensureIdsAreObjectIds({
      _id: message_id,
      room_id
    })
    return db.messages.remove(query, function(error) {
      if (error != null) {
        return callback(error)
      }
      return callback()
    })
  },

  _ensureIdsAreObjectIds(query) {
    if (query.user_id != null && !(query.user_id instanceof ObjectId)) {
      query.user_id = ObjectId(query.user_id)
    }
    if (query.room_id != null && !(query.room_id instanceof ObjectId)) {
      query.room_id = ObjectId(query.room_id)
    }
    if (query._id != null && !(query._id instanceof ObjectId)) {
      query._id = ObjectId(query._id)
    }
    return query
  }
}

;[
  'createMessage',
  'getMessages',
  'findAllMessagesInRooms',
  'updateMessage',
  'deleteMessage'
].map(method =>
  metrics.timeAsyncMethod(
    MessageManager,
    method,
    'mongo.MessageManager',
    logger
  )
)
