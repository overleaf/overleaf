settings =
	redis:

		pubsub:
			host: process.env['PUBSUB_REDIS_HOST'] or process.env['REDIS_HOST'] or "localhost"
			port: process.env['PUBSUB_REDIS_PORT'] or process.env['REDIS_PORT'] or "6379"
			password: process.env["PUBSUB_REDIS_PASSWORD"] or process.env["REDIS_PASSWORD"] or ""

		realtime:
			host: process.env['REAL_TIME_REDIS_HOST'] or process.env['REDIS_HOST'] or "localhost"
			port: process.env['REAL_TIME_REDIS_PORT'] or process.env['REDIS_PORT'] or "6379"
			password: process.env["REAL_TIME_REDIS_PASSWORD"] or process.env["REDIS_PASSWORD"] or ""
			key_schema:
				clientsInProject: ({project_id}) -> "clients_in_project:{#{project_id}}"
				connectedUser: ({project_id, client_id})-> "connected_user:{#{project_id}}:#{client_id}"

		documentupdater:
			host: process.env['DOC_UPDATER_REDIS_HOST'] or process.env['REDIS_HOST'] or "localhost"
			port: process.env['DOC_UPDATER_REDIS_PORT'] or process.env['REDIS_PORT'] or "6379"
			password: process.env["DOC_UPDATER_REDIS_PASSWORD"] or process.env["REDIS_PASSWORD"] or ""
			key_schema:
				pendingUpdates: ({doc_id}) -> "PendingUpdates:{#{doc_id}}"

		websessions: 			
			host: process.env['WEB_REDIS_HOST'] or process.env['REDIS_HOST'] or "localhost"
			port: process.env['WEB_REDIS_PORT'] or process.env['REDIS_PORT'] or "6379"
			password: process.env["WEB_REDIS_PASSWORD"] or process.env["REDIS_PASSWORD"] or ""

	internal:
		realTime:
			port: 3026
			host: process.env['LISTEN_ADDRESS'] or "localhost"
			user: "sharelatex"
			pass: "password"
			
	apis:
		web:
			url: "http://#{process.env['WEB_API_HOST'] or process.env['WEB_HOST'] or "localhost"}:#{process.env['WEB_API_PORT'] or process.env['WEB_PORT'] or 3000}"
			user: process.env['WEB_API_USER'] or "sharelatex"
			pass: process.env['WEB_API_PASSWORD'] or "password"
		documentupdater:
			url: "http://#{process.env['DOCUMENT_UPDATER_HOST'] or process.env['DOCUPDATER_HOST'] or "localhost"}:3003"
			
	security:
		sessionSecret: process.env['SESSION_SECRET'] or "secret-please-change"
		
	cookieName: process.env['COOKIE_NAME'] or "sharelatex.sid"
	
	max_doc_length: 2 * 1024 * 1024 # 2mb

	forceDrainMsDelay: process.env['FORCE_DRAIN_MS_DELAY'] or false

	continualPubsubTraffic: process.env['CONTINUAL_PUBSUB_TRAFFIC'] or false

	checkEventOrder: process.env['CHECK_EVENT_ORDER'] or false
	
	sentry:
		dsn: process.env.SENTRY_DSN
	
# console.log settings.redis
module.exports = settings