request = require("request").defaults(jar: false)
{db, ObjectId} = require("../../../../app/js/mongojs")
settings = require("settings-sharelatex")

module.exports = DocstoreClient =

	createDoc: (project_id, doc_id, lines, callback = (error) ->) ->
		db.docs.save({_id: doc_id, project_id:project_id, lines: lines, rev:1}, callback)

	createDeletedDoc: (project_id, doc_id, lines, callback = (error) ->) ->
		db.docs.insert {
			_id: doc_id
			project_id: project_id
			lines: lines
			deleted: true
		}, callback

	getDoc: (project_id, doc_id, qs, callback = (error, res, body) ->) ->
		request.get {
			url: "http://localhost:#{settings.internal.docstore.port}/project/#{project_id}/doc/#{doc_id}"
			json: true
			qs:qs
		}, callback

	getAllDocs: (project_id, callback = (error, res, body) ->) ->
		request.get {
			url: "http://localhost:#{settings.internal.docstore.port}/project/#{project_id}/doc"
			json: true
		}, callback

	updateDoc: (project_id, doc_id, lines, callback = (error, res, body) ->) ->
		request.post {
			url: "http://localhost:#{settings.internal.docstore.port}/project/#{project_id}/doc/#{doc_id}"
			json:
				lines: lines
		}, callback

	deleteDoc: (project_id, doc_id, callback = (error, res, body) ->) ->
		request.del {
			url: "http://localhost:#{settings.internal.docstore.port}/project/#{project_id}/doc/#{doc_id}"
		}, callback	
		
	archiveAllDoc: (project_id, callback = (error, res, body) ->) ->
		request.get {
			url: "http://localhost:#{settings.internal.docstore.port}/project/#{project_id}/archive"
		}, callback	
	
