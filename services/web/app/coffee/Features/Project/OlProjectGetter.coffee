request = require 'request'
settings = require 'settings-sharelatex'
Errors = require '../Errors/Errors'

makeRequest = (opts, callback) ->
	if settings.apis?.olProjects?.url?
		urlPath = opts.url
		opts.url = "#{settings.apis.olProjects.url}#{urlPath}"
		request opts, callback
	else
		callback(new Errors.ServiceNotConfiguredError('OL Projects service not configured'))

module.exports = OlProjectGetter =
	findAllUsersProjects: (userId, callback = (error, projects) ->) ->
		opts =
			method: 'GET'
			url: '/api/v0/current_user'
			json: true