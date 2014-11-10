sinon = require "sinon"
express = require "express"

module.exports = MockWebClient =
	projects: {}
	privileges: {}
	
	createMockProject: (project_id, privileges, project) ->
		MockWebClient.privileges[project_id] = privileges
		MockWebClient.projects[project_id] = project
		
	joinProject: (project_id, user_id, callback = (error, project, privilegeLevel) ->) ->
		callback(
			null,
			MockWebClient.projects[project_id], 
			MockWebClient.privileges[project_id][user_id]
		)
		
	joinProjectRequest: (req, res, next) ->
		{project_id} = req.params
		{user_id} = req.query
		MockWebClient.joinProject project_id, user_id, (error, project, privilegeLevel) ->
			return next(error) if error?
			res.json {
				project: project
				privilegeLevel: privilegeLevel
			}
	
	running: false
	run: (callback = (error) ->) ->
		if MockWebClient.running
			return callback()
		app = express()
		app.post "/project/:project_id/join", MockWebClient.joinProjectRequest
		app.listen 3000, (error) ->
			MockWebClient.running = true
			callback(error)
			
sinon.spy MockWebClient, "joinProject"