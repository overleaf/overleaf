settings = require("settings-sharelatex")
logger = require("logger-sharelatex")
s3Wrapper = require("./s3Wrapper")

logger.log backend:settings.filestoreBackend, "Loading backend"
module.exports = switch settings.filestoreBackend
	when "s3"
		s3Wrapper
	else
		throw new Error( "Unknown filestore backend: #{settings.filestoreBackend}" )
