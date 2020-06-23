sinon = require "sinon"
express = require "express"

module.exports = MockWebServer =
	projects: {}
	privileges: {}
	
	createMockProject: (project_id, privileges, project) ->
		MockWebServer.privileges[project_id] = privileges
		MockWebServer.projects[project_id] = project
		
	joinProject: (project_id, user_id, callback = (error, project, privilegeLevel) ->) ->
		callback(
			null,
			MockWebServer.projects[project_id], 
			MockWebServer.privileges[project_id][user_id]
		)
		
	joinProjectRequest: (req, res, next) ->
		{project_id} = req.params
		{user_id} = req.query
		if project_id == 'rate-limited'
			res.status(429).send()
		else
			MockWebServer.joinProject project_id, user_id, (error, project, privilegeLevel) ->
				return next(error) if error?
				res.json {
					project: project
					privilegeLevel: privilegeLevel
				}
	
	running: false
	run: (callback = (error) ->) ->
		if MockWebServer.running
			return callback()
		app = express()
		app.post "/project/:project_id/join", MockWebServer.joinProjectRequest
		app.listen 3000, (error) ->
			MockWebServer.running = true
			callback(error)
		.on "error", (error) ->
			console.error "error starting MockWebServer:", error.message
			process.exit(1)

			
sinon.spy MockWebServer, "joinProject"
