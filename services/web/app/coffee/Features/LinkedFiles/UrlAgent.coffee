request = require 'request'
_ = require "underscore"
urlValidator = require 'valid-url'
Settings = require 'settings-sharelatex'
{ InvalidUrlError, UrlFetchFailedError } = require './LinkedFilesErrors'
LinkedFilesHandler = require './LinkedFilesHandler'


module.exports = UrlAgent = {

	createLinkedFile: (project_id, linkedFileData, name, parent_folder_id, user_id, callback) ->
		linkedFileData = @._sanitizeData(linkedFileData)
		@_getUrlStream project_id, linkedFileData, user_id, (err, readStream) ->
			return callback(err) if err?
			readStream.on "error", callback
			readStream.on "response", (response) ->
				if 200 <= response.statusCode < 300
					readStream.resume()
					LinkedFilesHandler.importFromStream project_id,
						readStream,
						linkedFileData,
						name,
						parent_folder_id,
						user_id,
						(err, file) ->
							return callback(err) if err?
							callback(null, file._id) # Created
				else
					error = new UrlFetchFailedError("url fetch failed: #{linkedFileData.url}")
					error.statusCode = response.statusCode
					callback(error)

	refreshLinkedFile: (project_id, linkedFileData, name, parent_folder_id, user_id, callback) ->
		@createLinkedFile project_id, linkedFileData, name, parent_folder_id, user_id, callback

	_sanitizeData: (data) ->
		return {
			provider: data.provider
			url: @._prependHttpIfNeeded(data.url)
		}

	_getUrlStream: (project_id, data, current_user_id, callback = (error, fsPath) ->) ->
		callback = _.once(callback)
		url = data.url
		if !urlValidator.isWebUri(url)
			return callback(new InvalidUrlError("invalid url: #{url}"))
		url = @_wrapWithProxy(url)
		readStream = request.get(url)
		readStream.pause()
		callback(null, readStream)

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
