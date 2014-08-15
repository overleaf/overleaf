module.exports =
	internal:
		chat:
			host: "localhost"
			port: 3010
	
	apis:
		web:
			url: "http://localhost:3000"
			user: "sharelatex"
			pass: "password"
			
	mongo:
		url : 'mongodb://127.0.0.1/sharelatex'

	redis:
		web:
			host: "localhost"
			port: "6379"
			password: ""