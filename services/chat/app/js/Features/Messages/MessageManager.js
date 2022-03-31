let MessageManager
const { db, ObjectId } = require('../../mongodb')
const metrics = require('@overleaf/metrics')
const logger = require('@overleaf/logger')

async function createMessage(roomId, userId, content, timestamp) {
  let newMessageOpts = {
    content,
    room_id: roomId,
    user_id: userId,
    timestamp,
  }
  newMessageOpts = _ensureIdsAreObjectIds(newMessageOpts)
  const confirmation = await db.messages.insertOne(newMessageOpts)
  newMessageOpts._id = confirmation.insertedId
  return newMessageOpts
}

async function getMessages(roomId, limit, before) {
  let query = { room_id: roomId }
  if (before) {
    query.timestamp = { $lt: before }
  }
  query = _ensureIdsAreObjectIds(query)
  return db.messages.find(query).sort({ timestamp: -1 }).limit(limit).toArray()
}

async function findAllMessagesInRooms(roomIds) {
  return db.messages
    .find({
      room_id: { $in: roomIds },
    })
    .toArray()
}

async function deleteAllMessagesInRoom(roomId) {
  await db.messages.deleteMany({
    room_id: roomId,
  })
}

async function deleteAllMessagesInRooms(roomIds) {
  await db.messages.deleteMany({
    room_id: { $in: roomIds },
  })
}

async function updateMessage(roomId, messageId, userId, content, timestamp) {
  const query = _ensureIdsAreObjectIds({
    _id: messageId,
    room_id: roomId,
  })
  if (userId) {
    query.user_id = ObjectId(userId)
  }
  const res = await db.messages.updateOne(query, {
    $set: {
      content,
      edited_at: timestamp,
    },
  })
  return res.modifiedCount === 1
}

async function deleteMessage(roomId, messageId) {
  const query = _ensureIdsAreObjectIds({
    _id: messageId,
    room_id: roomId,
  })
  await db.messages.deleteOne(query)
}

function _ensureIdsAreObjectIds(query) {
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
}

module.exports = MessageManager = {
  createMessage,
  getMessages,
  findAllMessagesInRooms,
  deleteAllMessagesInRoom,
  deleteAllMessagesInRooms,
  updateMessage,
  deleteMessage,
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
