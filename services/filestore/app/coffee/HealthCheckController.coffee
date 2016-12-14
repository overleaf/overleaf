fs = require("fs-extra")
path = require("path")
async = require("async")
fileConverter = require("./FileConverter")
keyBuilder = require("./KeyBuilder")
fileController = require("./FileController")
logger = require('logger-sharelatex')
settings = require("settings-sharelatex")
streamBuffers = require("stream-buffers")

checkCanStoreFiles = (callback)->
	req = {params:{}, query:{}, headers:{}}
	res = {}
	req.params.project_id = settings.health_check.project_id
	req.params.file_id = settings.health_check.file_id
	myWritableStreamBuffer = new streamBuffers.WritableStreamBuffer(initialSize: 100)
	keyBuilder.userFileKey req, res, ->
		fileController.getFile req, myWritableStreamBuffer
		myWritableStreamBuffer.on "close", ->
			if myWritableStreamBuffer.size() > 0
				callback()
			else
				logger.err "no data in write stream buffer for health check"
				callback()

checkFileConvert = (callback)->
	imgPath = path.join(settings.path.uploadFolder, "/tiny.pdf")
	console.log imgPath, settings.path.uploadFolder
	async.waterfall [
		(cb)->
			fs.copy("./tiny.pdf", imgPath, cb)
		(cb)-> fileConverter.thumbnail "./tiny.pdf", cb
		(resultPath, cb)-> fs.unlink resultPath, cb
		(resultPath, cb)-> fs.unlink imgPath, cb
	], callback


module.exports =

	check: (req, res)->
		async.parallel [checkFileConvert, checkCanStoreFiles], (err)->
			if err?
				logger.err err:err, "Health check: error running"
				return res.send 500
			else
				return res.send 200