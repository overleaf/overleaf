mongojs = require "../../mongojs"
db = mongojs.db
ObjectId = mongojs.ObjectId
async = require "async"

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

	_ensureIdsAreObjectIds: (query) ->
		if query.user_id? and query.user_id not instanceof ObjectId
			query.user_id = ObjectId(query.user_id)
		if query.room_id? and query.room_id not instanceof ObjectId
			query.room_id = ObjectId(query.room_id)
		return query
		
