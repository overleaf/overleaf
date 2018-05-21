settings = require("settings-sharelatex")
logger = require("logger-sharelatex")

# assume s3 if none specified
settings?.filestore?.backend ||= "s3"


logger.log backend:settings.filestore.backend, "Loading backend"
module.exports = switch settings.filestore.backend
	when "aws-sdk"
		require "./AWSSDKPersistorManager"
	when "s3"
		require("./S3PersistorManager")
	when "fs"
		require("./FSPersistorManager")
	else
		throw new Error( "Unknown filestore backend: #{settings.filestore.backend}" )
