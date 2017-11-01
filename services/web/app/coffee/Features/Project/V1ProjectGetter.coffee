fs = require 'fs'
path = require 'path'
logger = require 'logger-sharelatex'

INTEGRATION_MODULE_PATH = path.resolve(__dirname, '../../../../modules/overleaf-integration-web-module')

module.exports = V1ProjectGetter =
	integrationModuleExists: (callback = (error, stats) ->) ->
		fs.stat INTEGRATION_MODULE_PATH, (error, stats) ->
			if error? or !stats.isDirectory()
				return callback(false)
			return callback(true)

	findAllUsersProjects: (userId, callback = (error, projects) ->) ->
		V1ProjectGetter.integrationModuleExists (exists) ->
			if exists
				logger.log {exists}, "integration module does exist, loading V1 projects"
				V1ProjectListGetter = require(path.join(INTEGRATION_MODULE_PATH, 'app/coffee/ProjectList/ProjectListGetter'))
				V1ProjectListGetter.findAllUsersProjects(userId, callback)
			else
				logger.log {exists}, "integration modules doesn't exists, not loading V1 projects"
				return callback()
