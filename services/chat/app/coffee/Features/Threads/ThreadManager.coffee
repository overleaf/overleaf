mongojs = require("../../mongojs")
db = mongojs.db
ObjectId = mongojs.ObjectId

module.exports = ThreadManager =
	GLOBAL_THREAD: "GLOBAL"

	findOrCreateThread: (project_id, thread_id, callback = (error, thread) ->) ->
		query =
			project_id: ObjectId(project_id.toString())

		if thread_id? and thread_id != ThreadManager.GLOBAL_THREAD
			query.thread_id = ObjectId(thread_id.toString())

		# Threads used to be called rooms, and still are in the DB
		db.rooms.findOne query, (error, thread) ->
			return callback(error) if error?
			if thread?
				callback null, thread
			else
				db.rooms.save query, (error, thread) ->
					return callback(error) if error?
					callback null, thread
	
	findAllThreadRooms: (project_id, callback = (error, rooms) ->) ->
		db.rooms.find {
			project_id: ObjectId(project_id.toString())
			thread_id: { $exists: true }
		}, {
			thread_id: 1
		}, callback
	
	
		
