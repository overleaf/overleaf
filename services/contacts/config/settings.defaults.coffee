http = require('http')
http.globalAgent.maxSockets = 300

module.exports =
	internal:
		contacts:
			port: 3036
			host: process.env["LISTEN_ADDRESS"] or "localhost"

	mongo:
		url: process.env['MONGO_CONNECTION_STRING'] or "mongodb://#{process.env["MONGO_HOST"] or "localhost"}/sharelatex"
