request = require("request").defaults(jar: false)
{db, ObjectId} = require("../../../../app/js/mongojs")

module.exports = DocstoreClient =
	createDoc: (project_id, lines, callback = (error, doc_id) ->) ->
		doc_id = ObjectId()
		db.projects.insert {
			_id: project_id
			rootFolder: [{
				docs: [{
					_id: doc_id,
					lines: lines
				}]
			}]
		}, (error) ->
			return callback(error) if error?
			callback null, doc_id

	deleteProject: (project_id, callback = (error, res, body) ->) ->
		db.projects.remove _id: project_id, callback

	getDoc: (project_id, doc_id, callback = (error, doc) ->) ->
		request.get {
			url: "http://localhost:3016/project/#{project_id}/doc/#{doc_id}"
			json: true
		}, callback

	updateDoc: (project_id, doc_id, lines, callback = (error, res, body) ->) ->
		request.post {
			url: "http://localhost:3016/project/#{project_id}/doc/#{doc_id}"
			json:
				lines: lines
		}, callback
		
		
		
	
