fs = require("fs-extra")
path = require("path")
async = require("async")
fileConverter = require("./FileConverter")
keyBuilder = require("./KeyBuilder")
fileController = require("./FileController")
logger = require('logger-sharelatex')
settings = require("settings-sharelatex")
streamBuffers = require("stream-buffers")
_ = require('underscore')


checkCanStoreFiles = (callback)->
	callback = _.once(callback)
	req = {params:{}, query:{}, headers:{}}
	req.params.project_id = settings.health_check.project_id
	req.params.file_id = settings.health_check.file_id
	console.log settings
	myWritableStreamBuffer = new streamBuffers.WritableStreamBuffer(initialSize: 100)
	res = {
		send: (code) ->
			if code != 200
				callback(new Error("non-200 code from getFile: #{code}"))
	}
	myWritableStreamBuffer.send = res.send
	keyBuilder.userFileKey req, res, ->
		fileController.getFile req, myWritableStreamBuffer
		myWritableStreamBuffer.on "close", ->
			if myWritableStreamBuffer.size() > 0
				callback()
			else
				err = "no data in write stream buffer for health check"
				logger.err {err,}, "error performing health check"
				callback(err)

checkFileConvert = (callback)->
	imgPath = path.join(settings.path.uploadFolder, "/tiny.pdf")
	async.waterfall [
		(cb)->
			fs.copy("./tiny.pdf", imgPath, cb)
		(cb)-> fileConverter.thumbnail imgPath, cb
		(resultPath, cb)-> fs.unlink resultPath, cb
		(cb)-> fs.unlink imgPath, cb
	], callback


module.exports =

	check: (req, res) ->
		logger.log {}, "performing health check"
		async.parallel [checkFileConvert, checkCanStoreFiles], (err)->
			if err?
				logger.err err:err, "Health check: error running"
				res.send 500
			else
				res.send 200
