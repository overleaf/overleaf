{db, ObjectId} = require "./mongojs"

module.exports = MongoManager =
	findProject: (project_id, callback = (error, project) ->) ->
		db.projects.find _id: ObjectId(project_id.toString()), {}, (error, projects = []) ->
			callback error, projects[0]

	findDoc: (doc_id, callback = (error, doc) ->) ->
		db.docs.find _id: ObjectId(doc_id.toString()), {}, (error, docs = []) ->
			callback error, docs[0]

	updateDoc: (project_id, docPath, lines, callback = (error) ->) ->
		update =
			$set: {}
			$inc: {}
		update.$set["#{docPath}.lines"] = lines
		update.$inc["#{docPath}.rev"] = 1

		db.projects.update _id: ObjectId(project_id), update, callback

	upsertIntoDocCollection: (project_id, doc_id, lines, oldRev, callback)->
		update =
			$set:{}
		update.$set["lines"] = lines
		update.$set["project_id"] = ObjectId(project_id)
		update.$set["rev"] = oldRev + 1
		db.docs.update _id: ObjectId(doc_id), update, {upsert: true}, callback


	markDocAsDeleted: (doc_id, callback)->
		update =
			$set: {}
		update.$set["deleted"] = true
		db.docs.update _id: ObjectId(doc_id), update, (err)->
			callback(err)
