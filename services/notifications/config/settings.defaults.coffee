module.exports = Settings =
	internal:
		notifications:
			port: 3042
			host: process.env["LISTEN_ADDRESS"] or "localhost"

	mongo:
		url : "mongodb://#{process.env["MONGO_HOST"] or "localhost"}/sharelatex"

	notifications:
		healthCheck:
			user_id: "5620bece05509b0a7a3cbc62"


