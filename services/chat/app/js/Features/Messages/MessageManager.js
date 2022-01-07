let MessageManager
const { db, ObjectId } = require('../../mongodb')
const metrics = require('@overleaf/metrics')
const logger = require('@overleaf/logger')

module.exports = MessageManager = {
  createMessage(roomId, userId, content, timestamp, callback) {
    if (!callback) {
      callback = function () {}
    }
    let newMessageOpts = {
      content,
      room_id: roomId,
      user_id: userId,
      timestamp,
    }
    newMessageOpts = this._ensureIdsAreObjectIds(newMessageOpts)
    db.messages.insertOne(newMessageOpts, function (error, confirmation) {
      if (error) {
        return callback(error)
      }
      newMessageOpts._id = confirmation.insertedId
      callback(null, newMessageOpts)
    })
  },

  getMessages(roomId, limit, before, callback) {
    if (!callback) {
      callback = function () {}
    }
    let query = { room_id: roomId }
    if (before) {
      query.timestamp = { $lt: before }
    }
    query = this._ensureIdsAreObjectIds(query)
    db.messages
      .find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray(callback)
  },

  findAllMessagesInRooms(roomIds, callback) {
    if (!callback) {
      callback = function () {}
    }
    db.messages
      .find({
        room_id: { $in: roomIds },
      })
      .toArray(callback)
  },

  deleteAllMessagesInRoom(roomId, callback) {
    if (!callback) {
      callback = function () {}
    }
    db.messages.deleteMany(
      {
        room_id: roomId,
      },
      callback
    )
  },

  updateMessage(roomId, messageId, content, timestamp, callback) {
    if (!callback) {
      callback = function () {}
    }
    const query = this._ensureIdsAreObjectIds({
      _id: messageId,
      room_id: roomId,
    })
    db.messages.updateOne(
      query,
      {
        $set: {
          content,
          edited_at: timestamp,
        },
      },
      callback
    )
  },

  deleteMessage(roomId, messageId, callback) {
    if (!callback) {
      callback = function () {}
    }
    const query = this._ensureIdsAreObjectIds({
      _id: messageId,
      room_id: roomId,
    })
    db.messages.deleteOne(query, callback)
  },

  _ensureIdsAreObjectIds(query) {
    if (query.user_id && !(query.user_id instanceof ObjectId)) {
      query.user_id = ObjectId(query.user_id)
    }
    if (query.room_id && !(query.room_id instanceof ObjectId)) {
      query.room_id = ObjectId(query.room_id)
    }
    if (query._id && !(query._id instanceof ObjectId)) {
      query._id = ObjectId(query._id)
    }
    return query
  },
}
;[
  'createMessage',
  'getMessages',
  'findAllMessagesInRooms',
  'updateMessage',
  'deleteMessage',
].map(method =>
  metrics.timeAsyncMethod(
    MessageManager,
    method,
    'mongo.MessageManager',
    logger
  )
)
