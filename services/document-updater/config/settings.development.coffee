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
			url: "http://localhost:3014"

	redis:
		web:
			port:"6379"
			host:"localhost"
			password:""

	mongo:
		url: 'mongodb://127.0.0.1/sharelatex'
