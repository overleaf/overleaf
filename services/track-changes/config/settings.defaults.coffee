Path = require('path')
TMP_DIR = Path.resolve(Path.join(__dirname, "../../", "tmp"))

module.exports =
	mongo:
		url: 'mongodb://127.0.0.1/sharelatex'
	internal:
		trackchanges:
			port: 3015
			host: "localhost"
	apis:
		documentupdater:
			url: "http://localhost:3003"
		docstore:
			url: "http://localhost:3016"
		web:
			url: "http://localhost:3000"
			user: "sharelatex"
			pass: "password"
	redis:
		web:
			host: "localhost"
			port: 6379
			pass: ""

	trackchanges:
		s3:
			key: ""
			secret: ""
		stores:
			doc_history: ""


	path:
		dumpFolder:   Path.join(TMP_DIR, "dumpFolder")
