request = require("request").defaults(jar: false)
{db, ObjectId} = require("../../../../app/js/mongojs")

module.exports = DocstoreClient =
	createProject: (project_id, callback = (error) ->) ->
		db.projects.insert {
			_id: project_id
			rootFolder: [{ docs: [] }]
		}, callback

	createDoc: (project_id, doc_id, lines, version, callback = (error) ->) ->
		db.projects.update {
			_id: project_id
		}, {
			$push: {
				"rootFolder.0.docs": {
					_id: doc_id
					lines: lines
					version: version
				}
			}
		}, callback

	deleteProject: (project_id, callback = (error, res, body) ->) ->
		db.projects.remove _id: project_id, callback

	getDoc: (project_id, doc_id, callback = (error, res, body) ->) ->
		request.get {
			url: "http://localhost:3016/project/#{project_id}/doc/#{doc_id}"
			json: true
		}, callback

	getAllDocs: (project_id, callback = (error, res, body) ->) ->
		request.get {
			url: "http://localhost:3016/project/#{project_id}/doc"
			json: true
		}, callback

	updateDoc: (project_id, doc_id, lines, version, callback = (error, res, body) ->) ->
		request.post {
			url: "http://localhost:3016/project/#{project_id}/doc/#{doc_id}"
			json:
				lines: lines
				version: version
		}, callback

	deleteDoc: (project_id, doc_id, callback = (error, res, body) ->) ->
		request.del {
			url: "http://localhost:3016/project/#{project_id}/doc/#{doc_id}"
		}, callback
		
		
		
	
