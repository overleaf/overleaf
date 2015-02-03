request = require("request").defaults(jar: false)
{db, ObjectId} = require("../../../../app/js/mongojs")

module.exports = DocstoreClient =
	createProject: (project_id, callback = (error) ->) ->
		db.projects.insert {
			_id: project_id
			rootFolder: [{ docs: [] }]
		}, callback

	createDoc: (project_id, doc_id, lines, callback = (error) ->) ->
		db.projects.update {
			_id: project_id
		}, {
			$push: {
				"rootFolder.0.docs": {
					_id: doc_id
					lines: lines
				}
			}
		}, callback

	createDeletedDoc: (project_id, doc_id, lines, callback = (error) ->) ->
		db.docs.insert {
			_id: doc_id
			project_id: project_id
			lines: lines
			deleted: true
		}, callback

	deleteProject: (project_id, callback = (error, res, body) ->) ->
		db.projects.remove _id: project_id, callback

	getDoc: (project_id, doc_id, qs, callback = (error, res, body) ->) ->
		request.get {
			url: "http://localhost:3016/project/#{project_id}/doc/#{doc_id}"
			json: true
			qs:qs
		}, callback

	getAllDocs: (project_id, callback = (error, res, body) ->) ->
		request.get {
			url: "http://localhost:3016/project/#{project_id}/doc"
			json: true
		}, callback

	updateDoc: (project_id, doc_id, lines, callback = (error, res, body) ->) ->
		request.post {
			url: "http://localhost:3016/project/#{project_id}/doc/#{doc_id}"
			json:
				lines: lines
		}, callback

	deleteDoc: (project_id, doc_id, callback = (error, res, body) ->) ->
		request.del {
			url: "http://localhost:3016/project/#{project_id}/doc/#{doc_id}"
		}, callback	
		
		
	
