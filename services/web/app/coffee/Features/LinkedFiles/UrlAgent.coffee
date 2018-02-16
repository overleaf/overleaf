request = require 'request'
FileWriter = require('../../infrastructure/FileWriter')

module.exports = UrlAgent = {
	sanitizeData: (data) ->
		return {
			url: data.url
		}

	writeIncomingFileToDisk: (project_id, data, current_user_id, callback = (error, fsPath) ->) ->
		# TODO: Check it's a valid URL
		# TODO: Proxy through external API
		# TODO: Error unless valid status code
		url = data.url
		readStream = request.get(url)
		FileWriter.writeStreamToDisk project_id, readStream, callback
}