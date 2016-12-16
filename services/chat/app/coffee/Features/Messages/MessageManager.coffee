mongojs = require "../../mongojs"
db = mongojs.db
ObjectId = mongojs.ObjectId
WebApiManager = require "../WebApi/WebApiManager"
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

	populateMessagesWithUsers: (messages, callback = (error, messages) ->) ->
		jobs = new Array()

		userCache = {}
		getUserDetails = (user_id, callback = (error, user) ->) ->
			return callback(null, userCache[user_id]) if userCache[user_id]?
			WebApiManager.getUserDetails user_id, (error, user) ->
				return callback(error) if error?
				userCache[user_id] = user
				callback null, user

		for message in messages
			do (message) ->
				if !message?
					return
				jobs.push (callback) ->
					getUserDetails message.user_id.toString(), (error, user) ->
						return callback(error) if error?
						delete message.user_id
						message.user = user
						callback(null, message)

		async.series jobs, callback
	
	_ensureIdsAreObjectIds: (query) ->
		if query.user_id? and query.user_id not instanceof ObjectId
			query.user_id = ObjectId(query.user_id)
		if query.room_id? and query.room_id not instanceof ObjectId
			query.room_id = ObjectId(query.room_id)
		return query
		
