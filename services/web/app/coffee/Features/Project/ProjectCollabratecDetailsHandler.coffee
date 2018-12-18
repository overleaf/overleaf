ObjectId = require("mongojs").ObjectId
Project = require("../../models/Project").Project

module.exports = ProjectCollabratecDetailsHandler =
	initializeCollabratecProject: (project_id, user_id, collabratec_document_id, collabratec_privategroup_id, callback=(err)->) ->
		ProjectCollabratecDetailsHandler.setCollabratecUsers project_id, [ { user_id, collabratec_document_id, collabratec_privategroup_id } ], callback

	isLinkedCollabratecUserProject: (project_id, user_id, callback=(err, isLinked)->) ->
		try
			project_id = ObjectId project_id
			user_id = ObjectId user_id
		catch err
			return callback err
		query =
			_id: project_id
			collabratecUsers: $elemMatch:
				user_id: user_id
		Project.findOne query, {_id: 1}, (err, project) ->
			callback err if err?
			callback null, project?

	linkCollabratecUserProject: (project_id, user_id, collabratec_document_id, callback=(err)->) ->
		try
			project_id = ObjectId project_id
			user_id = ObjectId user_id
		catch err
			return callback err
		query =
			_id: project_id
			collabratecUsers: $not: $elemMatch:
				collabratec_document_id: collabratec_document_id
				user_id: user_id
		update = $push: collabratecUsers:
			collabratec_document_id: collabratec_document_id
			user_id: user_id
		Project.update query, update, callback

	setCollabratecUsers: (project_id, collabratec_users, callback=(err)->) ->
		try
			project_id = ObjectId project_id
		catch err
			return callback err
		callback(new Error "collabratec_users must be array") unless Array.isArray(collabratec_users)
		for collabratec_user in collabratec_users
			try
				collabratec_user.user_id = ObjectId(collabratec_user.user_id)
			catch err
				return callback err
		update = $set: { collabratecUsers: collabratec_users }
		Project.update { _id: project_id }, update, callback

	unlinkCollabratecUserProject: (project_id, user_id, callback=(err)->) ->
		try
			project_id = ObjectId project_id
			user_id = ObjectId user_id
		catch err
			return callback err
		query =
			_id: project_id
		update = $pull: collabratecUsers:
			user_id: user_id
		Project.update query, update, callback

	updateCollabratecUserIds: (old_user_id, new_user_id, callback=(err)->) ->
		try
			old_user_id = ObjectId old_user_id
			new_user_id = ObjectId new_user_id
		catch err
			return callback err
		query = "collabratecUsers.user_id": old_user_id
		update = $set: "collabratecUsers.$.user_id": new_user_id
		options = multi: true
		Project.update query, update, options, callback
