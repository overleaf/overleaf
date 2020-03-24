settings =
	redis:

		pubsub:
			host: process.env['PUBSUB_REDIS_HOST'] or process.env['REDIS_HOST'] or "localhost"
			port: process.env['PUBSUB_REDIS_PORT'] or process.env['REDIS_PORT'] or "6379"
			password: process.env["PUBSUB_REDIS_PASSWORD"] or process.env["REDIS_PASSWORD"] or ""
			maxRetriesPerRequest: parseInt(process.env["PUBSUB_REDIS_MAX_RETRIES_PER_REQUEST"] or process.env["REDIS_MAX_RETRIES_PER_REQUEST"] or "20")

		realtime:
			host: process.env['REAL_TIME_REDIS_HOST'] or process.env['REDIS_HOST'] or "localhost"
			port: process.env['REAL_TIME_REDIS_PORT'] or process.env['REDIS_PORT'] or "6379"
			password: process.env["REAL_TIME_REDIS_PASSWORD"] or process.env["REDIS_PASSWORD"] or ""
			key_schema:
				clientsInProject: ({project_id}) -> "clients_in_project:{#{project_id}}"
				connectedUser: ({project_id, client_id})-> "connected_user:{#{project_id}}:#{client_id}"
			maxRetriesPerRequest: parseInt(process.env["REAL_TIME_REDIS_MAX_RETRIES_PER_REQUEST"] or process.env["REDIS_MAX_RETRIES_PER_REQUEST"] or "20")

		documentupdater:
			host: process.env['DOC_UPDATER_REDIS_HOST'] or process.env['REDIS_HOST'] or "localhost"
			port: process.env['DOC_UPDATER_REDIS_PORT'] or process.env['REDIS_PORT'] or "6379"
			password: process.env["DOC_UPDATER_REDIS_PASSWORD"] or process.env["REDIS_PASSWORD"] or ""
			key_schema:
				pendingUpdates: ({doc_id}) -> "PendingUpdates:{#{doc_id}}"
			maxRetriesPerRequest: parseInt(process.env["DOC_UPDATER_REDIS_MAX_RETRIES_PER_REQUEST"] or process.env["REDIS_MAX_RETRIES_PER_REQUEST"] or "20")

		websessions: 			
			host: process.env['WEB_REDIS_HOST'] or process.env['REDIS_HOST'] or "localhost"
			port: process.env['WEB_REDIS_PORT'] or process.env['REDIS_PORT'] or "6379"
			password: process.env["WEB_REDIS_PASSWORD"] or process.env["REDIS_PASSWORD"] or ""
			maxRetriesPerRequest: parseInt(process.env["WEB_REDIS_MAX_RETRIES_PER_REQUEST"] or process.env["REDIS_MAX_RETRIES_PER_REQUEST"] or "20")

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

	# combine
	# max_doc_length (2mb see above) * 2 (delete + insert)
	# max_ranges_size (3mb see MAX_RANGES_SIZE in document-updater)
	# overhead for JSON serialization
	maxUpdateSize: parseInt(process.env['MAX_UPDATE_SIZE']) or 7 * 1024 * 1024 + 64 * 1024

	shutdownDrainTimeWindow: process.env['SHUTDOWN_DRAIN_TIME_WINDOW'] or 9

	continualPubsubTraffic: process.env['CONTINUAL_PUBSUB_TRAFFIC'] or false

	checkEventOrder: process.env['CHECK_EVENT_ORDER'] or false
	
	publishOnIndividualChannels: process.env['PUBLISH_ON_INDIVIDUAL_CHANNELS'] or false

	statusCheckInterval: parseInt(process.env['STATUS_CHECK_INTERVAL'] or '0')

	sentry:
		dsn: process.env.SENTRY_DSN

	errors:
		catchUncaughtErrors: true
		shutdownOnUncaughtError: true
	
# console.log settings.redis
module.exports = settings
