Path = require('path')
http = require('http')
http.globalAgent.maxSockets = 300

module.exports =
	internal:
		documentupdater:
			host: process.env["LISTEN_ADDRESS"] or "localhost"
			port: 3003

	apis:
		web:
			url: "http://#{process.env["WEB_HOST"] or "localhost"}:3000"
			user: "sharelatex"
			pass: "password"
		trackchanges:
			url: "http://#{process.env["TRACK_CHANGES_HOST"] or "localhost"}:3015"
		project_history:
			enabled: true
			url: "http://#{process.env["PROJECT_HISTORY_HOST"] or "localhost"}:3054"

	redis:
		realtime:
			port: "6379"
			host: process.env["REDIS_HOST"] or "localhost"
			password:""
			key_schema:
				pendingUpdates: ({doc_id}) -> "PendingUpdates:#{doc_id}"
			# cluster: [{
			# 	port: "7000"
			# 	host: "localhost"
			# }]
			# key_schema:
			# 	pendingUpdates: ({doc_id}) -> "PendingUpdates:{#{doc_id}}"
		documentupdater:
			port: "6379"
			host: process.env["REDIS_HOST"] or "localhost"
			password: ""
			key_schema:
				blockingKey: ({doc_id}) -> "Blocking:#{doc_id}"
				docLines: ({doc_id}) -> "doclines:#{doc_id}"
				docOps: ({doc_id}) -> "DocOps:#{doc_id}"
				docVersion: ({doc_id}) -> "DocVersion:#{doc_id}"
				docHash: ({doc_id}) -> "DocHash:#{doc_id}"
				projectKey: ({doc_id}) -> "ProjectId:#{doc_id}"
				docsInProject: ({project_id}) -> "DocsIn:#{project_id}"
				ranges: ({doc_id}) -> "Ranges:#{doc_id}"
				pathname: ({doc_id}) -> "Pathname:#{doc_id}"
				projectState: ({project_id}) -> "ProjectState:#{project_id}"
				unflushedTime: ({doc_id}) -> "UnflushedTime:#{doc_id}"
			# cluster: [{
			# 	port: "7000"
			# 	host: "localhost"
			# }]
			# key_schema:
			# 	blockingKey: ({doc_id}) -> "Blocking:{#{doc_id}}"
			# 	docLines: ({doc_id}) -> "doclines:{#{doc_id}}"
			# 	docOps: ({doc_id}) -> "DocOps:{#{doc_id}}"
			# 	docVersion: ({doc_id}) -> "DocVersion:{#{doc_id}}"
			# 	docHash: ({doc_id}) -> "DocHash:{#{doc_id}}"
			# 	projectKey: ({doc_id}) -> "ProjectId:{#{doc_id}}"
			# 	docsInProject: ({project_id}) -> "DocsIn:{#{project_id}}"
			# 	ranges: ({doc_id}) -> "Ranges:{#{doc_id}}"
			# 	projectState: ({project_id}) -> "ProjectState:{#{project_id}}"
		history:
			port: "6379"
			host: process.env["REDIS_HOST"] or "localhost"
			password:""
			key_schema:
				uncompressedHistoryOps: ({doc_id}) -> "UncompressedHistoryOps:#{doc_id}"
				docsWithHistoryOps: ({project_id}) -> "DocsWithHistoryOps:#{project_id}"

		project_history:
			key_schema:
				projectHistoryOps: ({project_id}) -> "ProjectHistory:Ops:#{project_id}"
			# cluster: [{
			# 	port: "7000"
			# 	host: "localhost"
			# }]
			# key_schema:
			# 	uncompressedHistoryOps: ({doc_id}) -> "UncompressedHistoryOps:{#{doc_id}}"
			# 	docsWithHistoryOps: ({project_id}) -> "DocsWithHistoryOps:{#{project_id}}"
		lock:
			port: "6379"
			host: process.env["REDIS_HOST"] or "localhost"
			password:""
			key_schema:
				blockingKey: ({doc_id}) -> "Blocking:#{doc_id}"
			# cluster: [{
			# 	port: "7000"
			# 	host: "localhost"
			# }]
			# key_schema:
			# 	blockingKey: ({doc_id}) -> "Blocking:{#{doc_id}}"
	
	max_doc_length: 2 * 1024 * 1024 # 2mb

	mongo:
		url: "mongodb://#{process.env["MONGO_HOST"] or "localhost"}/sharelatex"
