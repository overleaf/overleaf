Path = require('path')
http = require('http')
http.globalAgent.maxSockets = 300

module.exports =
	internal:
		documentupdater:
			port: 3003

	apis:
		web:
			url: "http://localhost:3000"
			user: "sharelatex"
			pass: "password"
		trackchanges:
			url: "http://localhost:3015"

	redis:
		web:
			port:"6379"
			host:"localhost"
			password:""
		zip:
			minSize: 10*1024
			writesEnabled: false
	
	max_doc_length: 2 * 1024 * 1024 # 2mb

	mongo:
		url: 'mongodb://127.0.0.1/sharelatex'
