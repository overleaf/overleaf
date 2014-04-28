{db, ObjectId} = require "./mongojs"

module.exports = MongoManager =
	findProject: (project_id, callback = (error, project) ->) ->
		db.projects.find _id: ObjectId(project_id.toString()), {}, (error, projects = []) ->
			callback error, projects[0]