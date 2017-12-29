http = require('http')
http.globalAgent.maxSockets = 300

module.exports =
	internal:
		contacts:
			port: 3036
			host: process.env["LISTEN_ADDRESS"] or "localhost"

	mongo:
		url: "mongodb://#{process.env["MONGO_HOST"] or "localhost"}/sharelatex"
