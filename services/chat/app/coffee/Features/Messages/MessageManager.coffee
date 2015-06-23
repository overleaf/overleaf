mongojs = require "../../mongojs"
db = mongojs.db
ObjectId = mongojs.ObjectId
WebApiManager = require "../WebApi/WebApiManager"
async = require "async"

module.exports = MessageManager =
	createMessage: (message, callback = (error, message) ->) ->
		message = @_ensureIdsAreObjectIds(message)
		db.messages.save message, callback

	getMessages: (query, options, callback = (error, messages) ->) ->
		query = @_ensureIdsAreObjectIds(query)
		cursor = db.messages.find(query)
		if options.order_by?
			options.sort_order ||= 1
			sortQuery = {}
			sortQuery[options.order_by] = options.sort_order
			cursor = cursor.sort(sortQuery)
		if options.limit?
			cursor = cursor.limit(options.limit)
		cursor.toArray callback

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
		
