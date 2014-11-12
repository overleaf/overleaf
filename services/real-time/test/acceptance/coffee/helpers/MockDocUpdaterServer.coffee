sinon = require "sinon"
express = require "express"

module.exports = MockDocUpdaterServer =
	docs: {}
	
	createMockDoc: (project_id, doc_id, data) ->
		MockDocUpdaterServer.docs["#{project_id}:#{doc_id}"] = data
		
	getDocument: (project_id, doc_id, fromVersion, callback = (error, data) ->) ->
		callback(
			null, MockDocUpdaterServer.docs["#{project_id}:#{doc_id}"]
		)
		
	getDocumentRequest: (req, res, next) ->
		{project_id, doc_id} = req.params
		{fromVersion} = req.query
		fromVersion = parseInt(fromVersion, 10)
		MockDocUpdaterServer.getDocument project_id, doc_id, fromVersion, (error, data) ->
			return next(error) if error?
			res.json data
	
	running: false
	run: (callback = (error) ->) ->
		if MockDocUpdaterServer.running
			return callback()
		app = express()
		app.get "/project/:project_id/doc/:doc_id", MockDocUpdaterServer.getDocumentRequest
		app.listen 3003, (error) ->
			MockDocUpdaterServer.running = true
			callback(error)
			
sinon.spy MockDocUpdaterServer, "getDocument"