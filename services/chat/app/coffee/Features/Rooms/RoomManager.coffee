mongojs = require("../../mongojs")
db = mongojs.db
ObjectId = mongojs.ObjectId

module.exports = RoomManager =
	findOrCreateRoom: (query, callback = (error, room) ->) ->
		if query.project_id? and query.project_id not instanceof ObjectId
			query.project_id = ObjectId(query.project_id)

		db.rooms.findOne query, (error, room) ->
			return callback(error) if error?
			if room?
				callback null, room
			else
				db.rooms.save query, (error, room) ->
					return callback(error) if error?
					callback null, room
		
