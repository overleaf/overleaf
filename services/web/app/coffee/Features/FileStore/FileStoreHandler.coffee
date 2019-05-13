logger = require("logger-sharelatex")
fs = require("fs")
request = require("request")
settings = require("settings-sharelatex")
Async = require('async')
FileHashManager = require("./FileHashManager")
File = require('../../models/File').File

oneMinInMs = 60 * 1000
fiveMinsInMs = oneMinInMs * 5

module.exports = FileStoreHandler =

	RETRY_ATTEMPTS: 3

	uploadFileFromDisk: (project_id, file_args, fsPath, callback = (error, url, fileRef) ->)->
		fs.lstat fsPath, (err, stat)->
			if err?
				logger.err err:err, project_id:project_id, file_args:file_args, fsPath:fsPath, "error stating file"
				callback(err)
			if !stat?
				logger.err project_id:project_id, file_args:file_args, fsPath:fsPath, "stat is not available, can not check file from disk"
				return callback(new Error("error getting stat, not available"))
			if !stat.isFile()
				logger.log project_id:project_id, file_args:file_args, fsPath:fsPath, "tried to upload symlink, not contining"
				return callback(new Error("can not upload symlink"))
			Async.retry FileStoreHandler.RETRY_ATTEMPTS, (cb, results) ->
				FileStoreHandler._doUploadFileFromDisk project_id, file_args, fsPath, cb
			, (err, result) ->
				if err?
					logger.err {err, project_id, file_args}, "Error uploading file, retries failed"
					return callback(err)
				callback(err, result.url, result.fileRef)

	_doUploadFileFromDisk: (project_id, file_args, fsPath, callback = (err, result)->) ->
			_cb = callback
			callback = (err, result...) ->
				callback = ->	# avoid double callbacks
				_cb(err, result...)

			FileHashManager.computeHash fsPath, (err, hashValue) ->
				return callback(err) if err?
				fileRef = new File(Object.assign({}, file_args, {hash: hashValue}))
				file_id = fileRef._id
				logger.log project_id:project_id, file_id:file_id, fsPath:fsPath, hash: hashValue, fileRef:fileRef, "uploading file from disk"
				readStream = fs.createReadStream(fsPath)
				readStream.on "error", (err)->
					logger.err err:err, project_id:project_id, file_id:file_id, fsPath:fsPath, "something went wrong on the read stream of uploadFileFromDisk"
					callback err
				readStream.on "open", () ->
					url = FileStoreHandler._buildUrl(project_id, file_id)
					opts =
						method: "post"
						uri: url
						timeout:fiveMinsInMs
						headers:
							"X-File-Hash-From-Web": hashValue  # send the hash to the filestore as a custom header so it can be checked
					writeStream = request(opts)
					writeStream.on "error", (err)->
						logger.err err:err, project_id:project_id, file_id:file_id, fsPath:fsPath, "something went wrong on the write stream of uploadFileFromDisk"
						callback err
					writeStream.on 'response', (response) ->
						if response.statusCode not in [200, 201]
							err = new Error("non-ok response from filestore for upload: #{response.statusCode}")
							logger.err {err, statusCode: response.statusCode}, "error uploading to filestore"
							callback(err)
						else
							callback(null, {url, fileRef})  # have to pass back an object because async.retry only accepts a single result argument
					readStream.pipe writeStream

	getFileStream: (project_id, file_id, query, callback)->
		logger.log project_id:project_id, file_id:file_id, query:query, "getting file stream from file store"
		queryString = ""
		if query? and query["format"]?
			queryString = "?format=#{query['format']}"
		opts =
			method : "get"
			uri: "#{@_buildUrl(project_id, file_id)}#{queryString}"
			timeout:fiveMinsInMs
			headers: {}
		if query? and query['range']?
			rangeText = query['range']
			if rangeText && rangeText.match? && rangeText.match(/\d+-\d+/)
				opts.headers['range'] = "bytes=#{query['range']}"
		readStream = request(opts)
		readStream.on "error", (err) ->
			logger.err {err, project_id, file_id, query, opts}, "error in file stream"
		callback(null, readStream)

	deleteFile: (project_id, file_id, callback)->
		logger.log project_id:project_id, file_id:file_id, "telling file store to delete file"
		opts =
			method : "delete"
			uri: @_buildUrl(project_id, file_id)
			timeout:fiveMinsInMs
		request opts, (err, response)->
			if err?
				logger.err err:err, project_id:project_id, file_id:file_id, "something went wrong deleting file from filestore"
			callback(err)

	copyFile: (oldProject_id, oldFile_id, newProject_id, newFile_id, callback)->
		logger.log oldProject_id:oldProject_id, oldFile_id:oldFile_id, newProject_id:newProject_id, newFile_id:newFile_id, "telling filestore to copy a file"
		opts =
			method : "put"
			json:
				source:
					project_id:oldProject_id
					file_id:oldFile_id
			uri: @_buildUrl(newProject_id, newFile_id)
			timeout:fiveMinsInMs
		request opts, (err, response)->
			if err?
				logger.err err:err, oldProject_id:oldProject_id, oldFile_id:oldFile_id, newProject_id:newProject_id, newFile_id:newFile_id, "something went wrong telling filestore api to copy file"
				callback(err)
			else if 200 <= response.statusCode < 300
				# successful response
				callback(null, opts.uri)
			else
				err = new Error("non-ok response from filestore for copyFile: #{response.statusCode}")
				logger.err {uri: opts.uri, statusCode: response.statusCode}, "error uploading to filestore"
				callback(err)

	_buildUrl: (project_id, file_id)->
		return "#{settings.apis.filestore.url}/project/#{project_id}/file/#{file_id}"
