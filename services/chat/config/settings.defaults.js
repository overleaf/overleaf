module.exports =
	internal:
		chat:
			host: process.env['LISTEN_ADDRESS'] or "localhost"
			port: 3010
	
	apis:
		web:
			url: "http://#{process.env['WEB_HOST'] || "localhost"}:#{process.env['WEB_PORT'] or 3000}"
			user: "sharelatex"
			pass: "password"
			
	mongo:
		url : "mongodb://#{process.env['MONGO_HOST'] || "localhost"}/sharelatex"

	redis:
		web:
			host: process.env['REDIS_HOST'] || "localhost"
			port: "6379"
			password: ""