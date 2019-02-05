module.exports = Settings =
	internal:
		notifications:
			port: 3042
			host: process.env["LISTEN_ADDRESS"] or "localhost"

	mongo:
		url: process.env['MONGO_CONNECTION_STRING'] or "mongodb://#{process.env["MONGO_HOST"] or "localhost"}/sharelatex"
