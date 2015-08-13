http = require('http')
http.globalAgent.maxSockets = 300

module.exports =
	internal:
		docstore:
			port: 3016
			host: "localhost"

	mongo:
		url: 'mongodb://127.0.0.1/sharelatex'

	#docstore:
	#	s3:
	#		key: ""
	#		secret: ""
	#		bucket: "something"
