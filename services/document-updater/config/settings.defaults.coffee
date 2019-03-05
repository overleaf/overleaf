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
			url: "http://#{process.env['WEB_API_HOST'] or process.env['WEB_HOST'] or "localhost"}:#{process.env['WEB_API_PORT'] or process.env['WEB_PORT'] or 3000}"
			user: "sharelatex"
			pass: "password"
		trackchanges:
			url: "http://#{process.env["TRACK_CHANGES_HOST"] or "localhost"}:3015"
		project_history:
			enabled: true
			url: "http://#{process.env["PROJECT_HISTORY_HOST"] or "localhost"}:3054"

	redis:

		realtime:	
			port: process.env["REAL_TIME_REDIS_PORT"] or process.env["REDIS_PORT"] or "6379"	
			host: process.env["REAL_TIME_REDIS_HOST"] or process.env["REDIS_HOST"] or "localhost"	
			password: process.env["REAL_TIME_REDIS_PASSWORD"] or process.env["REDIS_PASSWORD"] or ""	
			redisOptions:	
				keepAlive: 100
			key_schema:	
				pendingUpdates: ({doc_id}) -> "PendingUpdates:{#{doc_id}}"
				
		history:
			port: process.env["HISTORY_REDIS_PORT"] or process.env["REDIS_PORT"] or "6379"
			host: process.env["HISTORY_REDIS_HOST"] or process.env["REDIS_HOST"] or "localhost"
			password: process.env["HISTORY_REDIS_PASSWORD"] or process.env["REDIS_PASSWORD"] or ""
			key_schema:
				uncompressedHistoryOps: ({doc_id}) -> "UncompressedHistoryOps:{#{doc_id}}"
				docsWithHistoryOps: ({project_id}) -> "DocsWithHistoryOps:{#{project_id}}"
			redisOptions:
				keepAlive: 100

		project_history:
			port: process.env["HISTORY_REDIS_PORT"] or process.env["REDIS_PORT"] or "6379"
			host: process.env["HISTORY_REDIS_HOST"] or process.env["REDIS_HOST"] or "localhost"
			password: process.env["HISTORY_REDIS_PASSWORD"] or process.env["REDIS_PASSWORD"] or ""
			key_schema:
				projectHistoryOps: ({project_id}) -> "ProjectHistory:Ops:{#{project_id}}"
				projectHistoryFirstOpTimestamp: ({project_id}) -> "ProjectHistory:FirstOpTimestamp:{#{project_id}}"
			redisOptions:
				keepAlive: 100

		lock:
			port: process.env["LOCK_REDIS_PORT"] or process.env["REDIS_PORT"] or "6379"
			host: process.env["LOCK_REDIS_HOST"] or process.env["REDIS_HOST"] or "localhost"
			password: process.env["LOCK_REDIS_PASSWORD"] or process.env["REDIS_PASSWORD"] or ""
			key_schema:
				blockingKey: ({doc_id}) -> "Blocking:{#{doc_id}}"
			redisOptions:
				keepAlive: 100

		documentupdater:
			port: process.env["DOC_UPDATER_REDIS_PORT"] or process.env["REDIS_PORT"] or "6379"
			host: process.env["DOC_UPDATER_REDIS_HOST"] or process.env["REDIS_HOST"] or "localhost"
			password: process.env["DOC_UPDATER_REDIS_PASSWORD"] or process.env["REDIS_PASSWORD"] or ""
			redisOptions:
				keepAlive: 100
			key_schema:
				blockingKey: ({doc_id}) -> "Blocking:{#{doc_id}}"
				docLines: ({doc_id}) -> "doclines:{#{doc_id}}"
				docOps: ({doc_id}) -> "DocOps:{#{doc_id}}"
				docVersion: ({doc_id}) -> "DocVersion:{#{doc_id}}"
				docHash: ({doc_id}) -> "DocHash:{#{doc_id}}"
				projectKey: ({doc_id}) -> "ProjectId:{#{doc_id}}"
				docsInProject: ({project_id}) -> "DocsIn:{#{project_id}}"
				ranges: ({doc_id}) -> "Ranges:{#{doc_id}}"
				unflushedTime: ({doc_id}) -> "UnflushedTime:{#{doc_id}}"
				pathname: ({doc_id}) -> "Pathname:{#{doc_id}}"
				projectHistoryId: ({doc_id}) -> "ProjectHistoryId:{#{doc_id}}"
				projectState: ({project_id}) -> "ProjectState:{#{project_id}}"
				pendingUpdates: ({doc_id}) -> "PendingUpdates:{#{doc_id}}"
			redisOptions:
				keepAlive: 100
	
	max_doc_length: 2 * 1024 * 1024 # 2mb

	dispatcherCount: process.env["DISPATCHER_COUNT"]

	mongo:
		url: "mongodb://#{process.env["MONGO_HOST"] or "localhost"}/sharelatex"

	sentry:
		dsn: process.env.SENTRY_DSN