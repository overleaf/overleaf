http = require('http')
http.globalAgent.maxSockets = 300

module.exports = Settings =
	internal:
		docstore:
			port: 3016
			host: process.env['LISTEN_ADDRESS'] or "localhost"

	mongo:
		url: "mongodb://#{process.env['MONGO_HOST'] or '127.0.0.1'}/sharelatex"

	docstore:
		healthCheck:
			project_id: ""

	max_doc_length: 2 * 1024 * 1024 # 2mb

if process.env['AWS_ACCESS_KEY_ID']? and process.env['AWS_SECRET_ACCESS_KEY']? and process.env['AWS_BUCKET']?
	Settings.docstore.s3 =
		key: process.env['AWS_ACCESS_KEY_ID']
		secret: process.env['AWS_SECRET_ACCESS_KEY']
		bucket: process.env['AWS_BUCKET']
console.log "SETTINGS"
console.log Settings.docstore.s3