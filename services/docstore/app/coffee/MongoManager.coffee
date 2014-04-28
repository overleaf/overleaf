{db, ObjectId} = require "./mongojs"

module.exports = MongoManager =
	findProject: (project_id, callback = (error, project) ->) ->
		db.projects.find _id: ObjectId(project_id.toString()), {}, (error, projects = []) ->
			callback error, projects[0]

	updateDoc: (project_id, docPath, lines, callback = (error) ->) ->
		update =
			$set: {}
			$inc: {}
		update.$set["#{docPath}.lines"] = lines
		update.$inc["#{docPath}.rev"] = 1

		db.projects.update _id: ObjectId(project_id), update, callback