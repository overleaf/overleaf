{db, ObjectId} = require "./mongojs"

module.exports = MongoManager =
	findProject: (project_id, callback = (error, project) ->) ->
		db.projects.find _id: ObjectId(project_id.toString()), {}, (error, projects = []) ->
			callback error, projects[0]

	updateDoc: (project_id, docPath, lines, version, callback = (error) ->) ->
		update =
			$set: {}
			$inc: {}
		update.$set["#{docPath}.lines"] = lines
		update.$set["#{docPath}.version"] = version if version?
		update.$inc["#{docPath}.rev"] = 1

		db.projects.update _id: ObjectId(project_id), update, callback

	insertDoc: (project_id, doc_id, attributes, callback = (error) ->) ->
		attributes._id = ObjectId(doc_id)
		attributes.project_id = ObjectId(project_id)
		db.docs.insert attributes, callback