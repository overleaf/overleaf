http = require('http')
http.globalAgent.maxSockets = 300

module.exports =
	internal:
		docstore:
			port: 3016
			host: "localhost"

	mongo:
		url: 'mongodb://127.0.0.1/sharelatex'

	#filestore:
	#	backend: "s3"
	#	stores:
	#		user_files: ""
	#	s3:
	#		key: ""
	#		secret: ""
	