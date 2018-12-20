mongojs = require("../../mongojs")
db = mongojs.db
ObjectId = mongojs.ObjectId
logger = require('logger-sharelatex')
metrics = require('metrics-sharelatex')

module.exports = ThreadManager =
	GLOBAL_THREAD: "GLOBAL"

	findOrCreateThread: (project_id, thread_id, callback = (error, thread) ->) ->
		project_id = ObjectId(project_id.toString())
		if thread_id != ThreadManager.GLOBAL_THREAD
			thread_id = ObjectId(thread_id.toString())

		if thread_id == ThreadManager.GLOBAL_THREAD
			query = {
				project_id: project_id
				thread_id: { $exists: false }
			}
			update = {
				project_id: project_id
			}
		else
			query = {
				project_id: project_id
				thread_id: thread_id
			}
			update = {
				project_id: project_id
				thread_id: thread_id
			}
		
		db.rooms.update query, update, { upsert: true }, (error) ->
			return callback(error) if error?
			db.rooms.find query, (error, rooms = []) ->
				return callback(error) if error?
				return callback null, rooms[0]
	
	findAllThreadRooms: (project_id, callback = (error, rooms) ->) ->
		db.rooms.find {
			project_id: ObjectId(project_id.toString())
			thread_id: { $exists: true }
		}, {
			thread_id: 1,
			resolved: 1
		}, callback
	
	resolveThread: (project_id, thread_id, user_id, callback = (error) ->) ->
		db.rooms.update {
			project_id: ObjectId(project_id.toString())
			thread_id: ObjectId(thread_id.toString())
		}, {
			$set: {
				resolved: {
					user_id: user_id
					ts: new Date()
				}
			}
		}, callback
	
	reopenThread: (project_id, thread_id, callback = (error) ->) ->
		db.rooms.update {
			project_id: ObjectId(project_id.toString())
			thread_id: ObjectId(thread_id.toString())
		}, {
			$unset: {
				resolved: true
			}
		}, callback

	deleteThread: (project_id, thread_id, callback = (error, room_id) ->) ->
		@findOrCreateThread project_id, thread_id, (error, room) ->
			return callback(error) if error?
			db.rooms.remove {
				_id: room._id
			}, (error) ->
				return callback(error) if error?
				return callback null, room._id


[
	 'findOrCreateThread',
	 'findAllThreadRooms',
	 'resolveThread',
	 'reopenThread',
	 'deleteThread',
].map (method) ->
	metrics.timeAsyncMethod(ThreadManager, method, 'mongo.ThreadManager', logger)
