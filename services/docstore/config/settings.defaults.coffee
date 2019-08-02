http = require('http')
http.globalAgent.maxSockets = 300

Settings =
	internal:
		docstore:
			port: 3016
			host: process.env['LISTEN_ADDRESS'] or "localhost"

	mongo:{}

	docstore:
		healthCheck:
			project_id: process.env['HEALTH_CHECK_PROJECT_ID']

	max_doc_length: 2 * 1024 * 1024 # 2mb

if process.env['MONGO_CONNECTION_STRING']?
	Settings.mongo.url = process.env['MONGO_CONNECTION_STRING']
else if process.env['MONGO_HOST']?
	Settings.mongo.url = "mongodb://#{process.env['MONGO_HOST']}/sharelatex"
else
	Settings.mongo.url = "mongodb://127.0.0.1/sharelatex"

if process.env['AWS_ACCESS_KEY_ID']? and process.env['AWS_SECRET_ACCESS_KEY']? and process.env['AWS_BUCKET']?
	Settings.docstore.s3 =
		key: process.env['AWS_ACCESS_KEY_ID']
		secret: process.env['AWS_SECRET_ACCESS_KEY']
		bucket: process.env['AWS_BUCKET']

module.exports = Settings
