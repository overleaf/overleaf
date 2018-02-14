request = require 'request'
FileWriter = require('../../infrastructure/FileWriter')

module.exports = UrlAgent = {
	sanitizeData: (data) ->
		return {
			url: data.url
		}

	writeIncomingFileToDisk: (project_id, data, current_user_id, callback = (error, fsPath) ->) ->
		# TODO: proxy through external API
		url = data.url
		readStream = request.get(url)
		FileWriter.writeStreamToDisk project_id, readStream, callback
}