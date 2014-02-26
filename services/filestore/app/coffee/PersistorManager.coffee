settings = require("settings-sharelatex")
logger = require("logger-sharelatex")
S3PersistorManager = require("./S3PersistorManager")

# assume s3 if none specified
settings.filestoreBackend ||= "s3"


logger.log backend:settings.filestoreBackend, "Loading backend"
module.exports = switch settings.filestoreBackend
	when "s3"
		S3PersistorManager
	else
		throw new Error( "Unknown filestore backend: #{settings.filestoreBackend}" )
