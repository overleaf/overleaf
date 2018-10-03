settings =
	internal:
		chat:
			host: process.env['LISTEN_ADDRESS'] or "localhost"
			port: 3010
	
	apis:
		web:
			url: "http://#{process.env['WEB_HOST'] || "localhost"}:3000"
			user: "sharelatex"
			pass: "password"
			
	mongo:
		url: process.env['MONGO_CONNECTION_STRING'] or "mongodb://#{process.env["MONGO_HOST"] or "localhost"}/sharelatex"


	redis:
		web:
			host: process.env['REDIS_HOST'] || "localhost"
			port: "6379"
			password: process.env['REDIS_PASSWORD'] || ""

module.exports = settings