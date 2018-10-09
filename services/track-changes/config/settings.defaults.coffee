Path = require('path')
TMP_DIR = Path.resolve(Path.join(__dirname, "../../", "tmp"))

module.exports =
	mongo:
		url: "mongodb://#{process.env["MONGO_HOST"] or "localhost"}/sharelatex"
	internal:
		trackchanges:
			port: 3015
			host: process.env["LISTEN_ADDRESS"] or "localhost"
	apis:
		documentupdater:
			url: "http://#{process.env["DOCUPDATER_HOST"] or "localhost"}:3003"
		docstore:
			url: "http://#{process.env["DOCSTORE_HOST"] or "localhost"}:3016"
		web:
			url: "http://#{process.env["WEB_HOST"] or "localhost"}:#{process.env['WEB_PORT'] or 3000}"
			user: "sharelatex"
			pass: "password"
	redis:
		lock:
			host: process.env["REDIS_HOST"] or "localhost"
			port: 6379
			pass: ""
			key_schema:
				historyLock: ({doc_id}) -> "HistoryLock:#{doc_id}"
				historyIndexLock: ({project_id}) -> "HistoryIndexLock:#{project_id}"
		history:
			port: "6379"
			host: process.env["REDIS_HOST"] or "localhost"
			password:""
			key_schema:
				uncompressedHistoryOps: ({doc_id}) -> "UncompressedHistoryOps:#{doc_id}"
				docsWithHistoryOps: ({project_id}) -> "DocsWithHistoryOps:#{project_id}"

	trackchanges:
		s3:
			key: ""
			secret: ""
		stores:
			doc_history: ""


	path:
		dumpFolder:   Path.join(TMP_DIR, "dumpFolder")
