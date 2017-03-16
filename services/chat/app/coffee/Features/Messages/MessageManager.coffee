mongojs = require "../../mongojs"
db = mongojs.db
ObjectId = mongojs.ObjectId
async = require "async"
metrics = require 'metrics-sharelatex'
logger = require 'logger-sharelatex'

module.exports = MessageManager =
	createMessage: (room_id, user_id, content, timestamp, callback = (error, message) ->) ->
		newMessageOpts = 
			content: content
			room_id: room_id
			user_id: user_id
			timestamp: timestamp
		newMessageOpts = @_ensureIdsAreObjectIds(newMessageOpts)
		db.messages.save newMessageOpts, callback

	getMessages: (room_id, limit, before, callback = (error, messages) ->) ->
		query =
			room_id: room_id
		if before?
			query.timestamp = { $lt: before }
		query = @_ensureIdsAreObjectIds(query)
		cursor = db.messages.find(query).sort({ timestamp: -1 }).limit(limit)
		cursor.toArray callback
	
	findAllMessagesInRooms: (room_ids, callback = (error, messages) ->) ->
		db.messages.find {
			room_id: { $in: room_ids }
		}, callback

	deleteAllMessagesInRoom: (room_id, callback = (error) ->) ->
		db.messages.remove {
			room_id: room_id
		}, callback
	
	updateMessage: (room_id, message_id, content, timestamp, callback = (error, message) ->) ->
		query = @_ensureIdsAreObjectIds(
			_id: message_id
			room_id: room_id
		)
		db.messages.update query, {
			$set:
				content: content
				edited_at: timestamp
		}, (error) ->
			return callback(error) if error?
			return callback()

	deleteMessage: (room_id, message_id, callback = (error) ->) ->
		query = @_ensureIdsAreObjectIds(
			_id: message_id
			room_id: room_id
		)
		db.messages.remove query, (error) ->
			return callback(error) if error?
			return callback()

	_ensureIdsAreObjectIds: (query) ->
		if query.user_id? and query.user_id not instanceof ObjectId
			query.user_id = ObjectId(query.user_id)
		if query.room_id? and query.room_id not instanceof ObjectId
			query.room_id = ObjectId(query.room_id)
		if query._id? and query._id not instanceof ObjectId
			query._id = ObjectId(query._id)
		return query
		

metrics.timeAsyncMethod(
	MessageManager, 'createMessage',
	'MessageManager.createMessage',
	logger
)
metrics.timeAsyncMethod(
	MessageManager, 'getMessages',
	'MessageManager.getMessages',
	logger
)
metrics.timeAsyncMethod(
	MessageManager, 'findAllMessagesInRooms',
	'MessageManager.findAllMessagesInRooms',
	logger
)
metrics.timeAsyncMethod(
	MessageManager, 'updateMessage',
	'MessageManager.updateMessage',
	logger
)
metrics.timeAsyncMethod(
	MessageManager, 'deleteMessage',
	'MessageManager.deleteMessage',
	logger
)
