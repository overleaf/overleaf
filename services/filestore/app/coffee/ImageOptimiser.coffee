PngCrush = require('pngcrush')
fs = require("fs")
logger = require("logger-sharelatex")


module.exports = 

	compressPng: (localPath, callback)->
		optimisedPath = "#{localPath}-optimised"
		startTime = new Date()
		logger.log localPath:localPath, optimisedPath:optimisedPath, "optimising png path"
		readStream = fs.createReadStream(localPath)
		writeStream = fs.createWriteStream(optimisedPath)
		readStream.on "error", (err)->
			logger.err err:err, localPath:localPath, "something went wrong getting read stream for compressPng"
			callback(err)
		writeStream.on "error", (err)->
			logger.err err:err, localPath:localPath, "something went wrong getting write stream for compressPng"
			callback(err)
		myCrusher = new PngCrush()
		myCrusher.on "error", (err)->
			logger.err err:err, localPath:localPath, "error compressing file"
			callback err
		readStream.pipe(myCrusher).pipe(writeStream)
		writeStream.on "finish", ->
			timeTaken = new Date() - startTime
			logger.log localPath:localPath, timeTaken:timeTaken, "finished converting file"
			fs.rename optimisedPath, localPath, callback

