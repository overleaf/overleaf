settings =
	redis:
		realtime:
			host: process.env['REAL_TIME_REDIS_HOST'] or process.env['REDIS_HOST'] or "localhost"
			port: process.env['REAL_TIME_REDIS_PORT'] or process.env['REDIS_PORT'] or "6379"
			password: process.env["REAL_TIME_REDIS_PASSWORD"] or process.env["REDIS_PASSWORD"] or ""
			key_schema:
				clientsInProject: ({project_id}) -> "clients_in_project:#{project_id}"
				connectedUser: ({project_id, client_id})-> "connected_user:#{project_id}:#{client_id}"
			cluster: process.env['REDIS_CLUSTER_HOSTS']
			natMap: process.env['REDIS_CLUSTER_NATMAP']

		documentupdater:
			host: process.env['DOC_UPDATER_REDIS_HOST'] or process.env['REDIS_HOST'] or "localhost"
			port: process.env['DOC_UPDATER_REDIS_PORT'] or process.env['REDIS_PORT'] or "6379"
			password: process.env["DOC_UPDATER_REDIS_PASSWORD"] or process.env["REDIS_PASSWORD"] or ""
			key_schema:
				pendingUpdates: ({doc_id}) -> "PendingUpdates:#{doc_id}"
			cluster: process.env['REDIS_CLUSTER_HOSTS']
			natMap: process.env['REDIS_CLUSTER_NATMAP']

		websessions: 			
			host: process.env['WEB_REDIS_HOST'] or process.env['REDIS_HOST'] or "localhost"
			port: process.env['WEB_REDIS_PORT'] or process.env['REDIS_PORT'] or "6379"
			password: process.env["WEB_REDIS_PASSWORD"] or process.env["REDIS_PASSWORD"] or ""
			cluster: process.env['REDIS_CLUSTER_HOSTS']
			natMap: process.env['REDIS_CLUSTER_NATMAP']

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

console.log process.env['REDIS_CLUSTER_HOSTS'], process.env['REDIS_CLUSTER_NATMAP']
if process.env['REDIS_CLUSTER_HOSTS']? or process.env['REDIS_CLUSTER_NATMAP']?

	for redisKey in Object.keys(settings.redis)
		
		if process.env['REDIS_CLUSTER_HOSTS']?
			settings.redis[redisKey].cluster = JSON.parse(process.env['REDIS_CLUSTER_HOSTS'])

		
		if process.env['REDIS_CLUSTER_NATMAP']?
			settings.redis[redisKey].natMap = JSON.parse(process.env['REDIS_CLUSTER_NATMAP'])
console.log settings
module.exports = settings