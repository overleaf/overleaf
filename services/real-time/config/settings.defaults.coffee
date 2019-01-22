settings =
	redis:
		realtime:
			host: process.env['REAL_TIME_REDIS_HOST'] or process.env['REDIS_HOST'] or "localhost"
			port: process.env['REAL_TIME_REDIS_PORT'] or process.env['REDIS_PORT'] or "6379"
			password: process.env["REAL_TIME_REDIS_PASSWORD"] or process.env["REDIS_PASSWORD"] or ""
			key_schema:
				clientsInProject: ({project_id}) -> "clients_in_project:#{project_id}"
				connectedUser: ({project_id, client_id})-> "connected_user:#{project_id}:#{client_id}"

		documentupdater:
			host: process.env['DOC_UPDATER_REDIS_HOST'] or process.env['REDIS_HOST'] or "localhost"
			port: process.env['DOC_UPDATER_REDIS_PORT'] or process.env['REDIS_PORT'] or "6379"
			password: process.env["DOC_UPDATER_REDIS_PASSWORD"] or process.env["REDIS_PASSWORD"] or ""
			key_schema:
				pendingUpdates: ({doc_id}) -> "PendingUpdates:#{doc_id}"

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
			url: "http://#{process.env['WEB_HOST'] or "localhost"}:#{process.env['WEB_PORT'] or 3000}"
			user: "sharelatex"
			pass: "password"
		documentupdater:
			url: "http://#{process.env['DOCUMENT_UPDATER_HOST'] or process.env['DOCUPDATER_HOST'] or "localhost"}:3003"
			
	security:
		sessionSecret: process.env['SESSION_SECRET'] or "secret-please-change"
		
	cookieName: process.env['COOKIE_NAME'] or "sharelatex.sid"
	
	max_doc_length: 2 * 1024 * 1024 # 2mb

	forceDrainMsDelay: process.env['FORCE_DRAIN_MS_DELAY'] or false

if process.env['REDIS_CLUSTER_ENABLED'] == "true"
	settings.redis.websessions.cluster = [
		{ host: process.env["SL_LIN_STAG_REDIS_3_SERVICE_HOST"], port: "6379" }
	]
	settings.redis.websessions.natMap =	{
		'192.168.201.24:6379': { host: process.env["SL_LIN_STAG_REDIS_0_SERVICE_HOST"], port: "6379" }
		'192.168.195.231:6379': { host: process.env["SL_LIN_STAG_REDIS_1_SERVICE_HOST"], port: "6379" }
		'192.168.223.53:6379': { host: process.env["SL_LIN_STAG_REDIS_2_SERVICE_HOST"], port: "6379" }
		'192.168.221.84:6379': { host: process.env["SL_LIN_STAG_REDIS_3_SERVICE_HOST"], port: "6379" }
		'192.168.219.81:6379': { host: process.env["SL_LIN_STAG_REDIS_4_SERVICE_HOST"], port: "6379" }
		'192.168.180.104:6379': { host: process.env["SL_LIN_STAG_REDIS_5_SERVICE_HOST"], port: "6379" }
		'192.168.220.59:6379': { host: process.env["SL_LIN_STAG_REDIS_6_SERVICE_HOST"], port: "6379" }
		'192.168.129.122:6379': { host: process.env["SL_LIN_STAG_REDIS_7_SERVICE_HOST"], port: "6379" }
	}
	
module.exports = settings