sinon = require('sinon')
logger = require("logger-sharelatex")

module.exports =
	getFileStream: sinon.stub()
	checkIfFileExists: sinon.stub()
	deleteFile: sinon.stub()
	deleteDirectory: sinon.stub()
	sendStreamToS3: sinon.stub()
	insertFile: sinon.stub()
	copyFile: sinon.stub()
