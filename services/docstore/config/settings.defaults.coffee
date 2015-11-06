http = require('http')
http.globalAgent.maxSockets = 300

module.exports =
	internal:
		docstore:
			port: 3016
			host: "localhost"

	mongo:
		url: 'mongodb://127.0.0.1/sharelatex'

	docstore:
		healthCheck:
			project_id: "5620bece05509b0a7a3cbc61"
	#	s3:
	#		key: ""
	#		secret: ""
	#		bucket: "something"

	max_doc_size: 2 * 1024 * 1024 # 2mb
