sinon = require "sinon"
express = require "express"

module.exports = MockTrackChangesServer =
	flushProject: sinon.stub().callsArg(1)
		
	flushProjectRequest: (req, res, next) ->
		{project_id} = req.params
		MockTrackChangesServer.flushProject project_id, (error) ->
			return next(error) if error?
			res.sendStatus 204
	
	running: false
	run: (callback = (error) ->) ->
		if MockTrackChangesServer.running
			return callback()
		app = express()
		app.post "/project/:project_id/flush", MockTrackChangesServer.flushProjectRequest
		app.listen 3015, (error) ->
			MockTrackChangesServer.running = true
			callback(error)