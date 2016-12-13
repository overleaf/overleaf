Path = require('path')

module.exports = Settings =
	internal:
		spelling:
			port: 3005
			host: "localhost"
			
	redis:
		port:6379
		host:"127.0.0.1"
		password:""
		
	mongo:
		url : 'mongodb://127.0.0.1/sharelatex'

	cacheDir: Path.resolve "cache"


	healthCheckUserId: "53c64d2fd68c8d000010bb5f"