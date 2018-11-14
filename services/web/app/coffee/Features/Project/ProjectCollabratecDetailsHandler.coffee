Project = require("../../models/Project").Project

module.exports = ProjectCollabratecDetailsHandler =
	initializeCollabratecProject: (project_id, name, user_id, collabratec_document_id, collabratec_privategroup_id, callback=(err)->) ->
		update = $set: { name, collabratecUsers: [ { user_id, collabratec_document_id, collabratec_privategroup_id } ] }
		Project.update { _id: project_id }, update, callback
