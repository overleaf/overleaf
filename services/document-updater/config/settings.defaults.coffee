Path = require('path')
http = require('http')
http.globalAgent.maxSockets = 300

module.exports =
	internal:
		documentupdater:
			port: 3003

	apis:
		web:
			url: "http://localhost:3000"
			user: "sharelatex"
			pass: "password"
		trackchanges:
			url: "http://localhost:3015"

	redis:
		realtime:
			port:"6379"
			host:"localhost"
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
			host: "localhost"
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
				projectState: ({project_id}) -> "ProjectState:#{project_id}"
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
			port:"6379"
			host:"localhost"
			password:""
			key_schema:
				uncompressedHistoryOps: ({doc_id}) -> "UncompressedHistoryOps:#{doc_id}"
				docsWithHistoryOps: ({project_id}) -> "DocsWithHistoryOps:#{project_id}"
			# cluster: [{
			# 	port: "7000"
			# 	host: "localhost"
			# }]
			# key_schema:
			# 	uncompressedHistoryOps: ({doc_id}) -> "UncompressedHistoryOps:{#{doc_id}}"
			# 	docsWithHistoryOps: ({project_id}) -> "DocsWithHistoryOps:{#{project_id}}"
		lock:
			port:"6379"
			host:"localhost"
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
		url: 'mongodb://127.0.0.1/sharelatex'
