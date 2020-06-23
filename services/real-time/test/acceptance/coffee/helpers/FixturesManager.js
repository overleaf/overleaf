RealTimeClient = require "./RealTimeClient"
MockWebServer = require "./MockWebServer"
MockDocUpdaterServer = require "./MockDocUpdaterServer"

module.exports = FixturesManager =
	setUpProject: (options = {}, callback = (error, data) ->) ->
		options.user_id        ||= FixturesManager.getRandomId()
		options.project_id     ||= FixturesManager.getRandomId()
		options.project        ||= { name: "Test Project" }
		{project_id, user_id, privilegeLevel, project, publicAccess} = options
		
		privileges = {}
		privileges[user_id] = privilegeLevel
		if publicAccess
			privileges["anonymous-user"] = publicAccess
		
		MockWebServer.createMockProject(project_id, privileges, project)
		MockWebServer.run (error) =>
			throw error if error?
			RealTimeClient.setSession {
				user: {
					_id: user_id
					first_name: "Joe"
					last_name: "Bloggs"
				}
			}, (error) =>
				throw error if error?
				callback null, {project_id, user_id, privilegeLevel, project}
				
	setUpDoc: (project_id, options = {}, callback = (error, data) ->) ->
		options.doc_id  ||= FixturesManager.getRandomId()
		options.lines   ||= ["doc", "lines"]
		options.version ||= 42
		options.ops     ||= ["mock", "ops"]
		{doc_id, lines, version, ops, ranges} = options
				
		MockDocUpdaterServer.createMockDoc project_id, doc_id, {lines, version, ops, ranges}
		MockDocUpdaterServer.run (error) =>
			throw error if error?
			callback null, {project_id, doc_id, lines, version, ops}
		
	getRandomId: () ->
		return require("crypto")
			.createHash("sha1")
			.update(Math.random().toString())
			.digest("hex")
			.slice(0,24)
		