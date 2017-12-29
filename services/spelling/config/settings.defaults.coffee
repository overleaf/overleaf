Path = require('path')

module.exports = Settings =
	internal:
		spelling:
			port: 3005
			host: process.env["LISTEN_ADDRESS"] or "localhost"
			
	redis:
		port: 6379
		host: process.env["REDIS_HOST"] or "localhost"
		password:""
		
	mongo:
		url : "mongodb://#{process.env["MONGO_HOST"] or "localhost"}/sharelatex"

	cacheDir: Path.resolve "cache"


	healthCheckUserId: "53c64d2fd68c8d000010bb5f"