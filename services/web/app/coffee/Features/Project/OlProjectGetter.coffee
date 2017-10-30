request = require 'request'
settings = require 'settings-sharelatex'
logger = require 'logger-sharelatex'
Errors = require '../Errors/Errors'
oAuthRequest = require '../../../../modules/overleaf-integration-web-module/app/coffee/oauth/OAuthRequest'

makeRequest = (opts, callback) ->
	if settings.apis?.olProjects?.url?
		urlPath = opts.url
		opts.url = "#{settings.apis.olProjects.url}#{urlPath}"
		request opts, callback
	else
		callback(new Errors.ServiceNotConfiguredError('OL Projects service not configured'))

module.exports = OlProjectGetter =
	findAllUsersProjects: (userId, callback = (error, projects) ->) ->
		oAuthRequest userId, {
			url: "#{settings.overleaf.host}/api/v1/sharelatex/docs"
			method: 'GET'
			json: true
		}, (error, docs) ->
			return callback(error) if error?
			logger.log {userId, docs}, "got projects from OL"
			callback(null, docs)