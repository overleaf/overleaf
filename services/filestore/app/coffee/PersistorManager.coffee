settings = require("settings-sharelatex")
logger = require("logger-sharelatex")
S3PersistorManager = require("./S3PersistorManager")

logger.log backend:settings.filestoreBackend, "Loading backend"
module.exports = switch settings.filestoreBackend
	when "s3",null
		S3PersistorManager
	else
		throw new Error( "Unknown filestore backend: #{settings.filestoreBackend}" )
