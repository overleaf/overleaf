fs = require 'fs'
path = require 'path'
logger = require 'logger-sharelatex'

INTEGRATION_MODULE_PATH = path.resolve(__dirname, '../../../../modules/overleaf-integration-web-module')

V1ProjectGetter =
	# Default implementation is a no-op
	findAllUsersProjects: (userId, callback = (error, projects) ->) ->
		logger.log {}, "integration modules doesn't exist, not loading V1 projects"
		return callback()

fs.stat INTEGRATION_MODULE_PATH, (error, stats) ->
	return if error? or !stats.isDirectory()
	logger.log {isDirectory: stats.isDirectory()}, "integration module does exist, loading V1 projects"
	# Monkey patch impl to actually fetch projects
	V1ProjectGetter.findAllUsersProjects = (userId, callback = (error, projects) ->) ->
		IntegrationProjectListGetter = require(path.join(INTEGRATION_MODULE_PATH, 'app/coffee/ProjectList/ProjectListGetter'))
		IntegrationProjectListGetter.findAllUsersProjects(userId, callback)

module.exports = V1ProjectGetter