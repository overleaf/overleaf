settings = require("settings-sharelatex")
logger = require("logger-sharelatex")

# assume s3 if none specified
settings.filestoreBackend ||= "s3"


logger.log backend:settings.filestoreBackend, "Loading backend"
module.exports = switch settings.filestoreBackend
	when "s3"
		require("./S3PersistorManager")
	when "fs"
		require("./FSPersistorManager")
	else
		throw new Error( "Unknown filestore backend: #{settings.filestoreBackend}" )
