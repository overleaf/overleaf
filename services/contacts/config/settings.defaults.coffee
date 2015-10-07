http = require('http')
http.globalAgent.maxSockets = 300

module.exports =
	internal:
		contacts:
			port: 3036
			host: "localhost"

	mongo:
		url: 'mongodb://127.0.0.1/sharelatex'
