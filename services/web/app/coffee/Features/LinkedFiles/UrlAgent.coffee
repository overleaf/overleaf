request = require 'request'
FileWriter = require('../../infrastructure/FileWriter')
_ = require "underscore"
urlValidator = require 'valid-url'
Settings = require 'settings-sharelatex'

UrlFetchFailedError = (message) ->
	error = new Error(message)
	error.name = 'UrlFetchFailedError'
	error.__proto__ = UrlFetchFailedError.prototype
	return error
UrlFetchFailedError.prototype.__proto__ = Error.prototype

InvalidUrlError = (message) ->
	error = new Error(message)
	error.name = 'InvalidUrlError'
	error.__proto__ = InvalidUrlError.prototype
	return error
InvalidUrlError.prototype.__proto__ = Error.prototype

module.exports = UrlAgent = {
	UrlFetchFailedError: UrlFetchFailedError
	InvalidUrlError: InvalidUrlError

	sanitizeData: (data) ->
		return {
			url: @._prependHttpIfNeeded(data.url)
		}

	checkAuth: (project_id, data, current_user_id, callback = (error, allowed)->) ->
		callback(null, true)

	writeIncomingFileToDisk: (project_id, data, current_user_id, callback = (error, fsPath) ->) ->
		callback = _.once(callback)
		url = data.url
		if !urlValidator.isWebUri(url)
			return callback(new InvalidUrlError("invalid url: #{url}"))
		url = UrlAgent._wrapWithProxy(url)
		readStream = request.get(url)
		readStream.on "error", callback
		readStream.on "response", (response) ->
			if 200 <= response.statusCode < 300
				FileWriter.writeStreamToDisk project_id, readStream, callback
			else
				error = new UrlFetchFailedError("url fetch failed: #{url}")
				error.statusCode = response.statusCode
				callback(error)

	handleError: (error, req, res, next) ->
		if error instanceof UrlFetchFailedError
			res.status(422).send(
				"Your URL could not be reached (#{error.statusCode} status code). Please check it and try again."
			)
		else if error instanceof InvalidUrlError
			res.status(422).send(
				"Your URL is not valid. Please check it and try again."
			)
		else
			next(error)

	_prependHttpIfNeeded: (url) ->
		if !url.match('://')
			url = 'http://' + url
		return url

	_wrapWithProxy: (url) ->
		# TODO: Consider what to do for Community and Enterprise edition?
		if !Settings.apis?.linkedUrlProxy?.url?
			throw new Error('no linked url proxy configured')
		return "#{Settings.apis.linkedUrlProxy.url}?url=#{encodeURIComponent(url)}"
}
