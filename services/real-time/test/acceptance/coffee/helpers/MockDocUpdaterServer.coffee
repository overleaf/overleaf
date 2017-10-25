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
		
	deleteProject: sinon.stub().callsArg(1)
		
	getDocumentRequest: (req, res, next) ->
		{project_id, doc_id} = req.params
		{fromVersion} = req.query
		fromVersion = parseInt(fromVersion, 10)
		MockDocUpdaterServer.getDocument project_id, doc_id, fromVersion, (error, data) ->
			return next(error) if error?
			res.json data
			
	deleteProjectRequest: (req, res, next) ->
		{project_id} = req.params
		MockDocUpdaterServer.deleteProject project_id, (error) ->
			return next(error) if error?
			res.sendStatus 204
	
	running: false
	run: (callback = (error) ->) ->
		if MockDocUpdaterServer.running
			return callback()
		app = express()
		app.get "/project/:project_id/doc/:doc_id", MockDocUpdaterServer.getDocumentRequest
		app.delete "/project/:project_id", MockDocUpdaterServer.deleteProjectRequest
		app.listen 3003, (error) ->
			MockDocUpdaterServer.running = true
			callback(error)
		.on "error", (error) ->
			console.error "error starting MockDocUpdaterServer:", error.message
			process.exit(1)

			
sinon.spy MockDocUpdaterServer, "getDocument"
