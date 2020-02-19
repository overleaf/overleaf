Path = require "path"

module.exports =
	# Options are passed to Sequelize.
	# See http://sequelizejs.com/documentation#usage-options for details
	mysql:
		clsi:
			database: "clsi"
			username: "clsi"
			dialect: "sqlite"
			storage: process.env["SQLITE_PATH"] or Path.resolve(__dirname + "/../db.sqlite")
			pool:
				max: 1
				min: 1
			retry:
				max: 10

	compileSizeLimit:  process.env["COMPILE_SIZE_LIMIT"] or "7mb"
	
	path:
		compilesDir:  Path.resolve(__dirname + "/../compiles")
		clsiCacheDir: Path.resolve(__dirname + "/../cache")
		synctexBaseDir: (project_id) -> Path.join(@compilesDir, project_id)

	internal:
		clsi:
			port: 3013
			host: process.env["LISTEN_ADDRESS"] or "localhost"
			
		load_balancer_agent:
			report_load:true
			load_port: 3048
			local_port: 3049
	apis:
		clsi:
			url: "http://#{process.env['CLSI_HOST'] or 'localhost'}:3013"

			
	smokeTest: process.env["SMOKE_TEST"] or false
	project_cache_length_ms: 1000 * 60 * 60 * 24
	parallelFileDownloads: process.env["FILESTORE_PARALLEL_FILE_DOWNLOADS"] or 1
	parallelSqlQueryLimit: process.env["FILESTORE_PARALLEL_SQL_QUERY_LIMIT"] or 1
	filestoreDomainOveride: process.env["FILESTORE_DOMAIN_OVERRIDE"]
	texliveImageNameOveride: process.env["TEX_LIVE_IMAGE_NAME_OVERRIDE"]
	sentry:
		dsn: process.env['SENTRY_DSN']


if process.env["DOCKER_RUNNER"]
	module.exports.clsi =
		dockerRunner: process.env["DOCKER_RUNNER"] == "true"
		docker:
			image: process.env["TEXLIVE_IMAGE"] or "quay.io/sharelatex/texlive-full:2017.1"
			env:
				HOME: "/tmp"
			socketPath: "/var/run/docker.sock"
			user: process.env["TEXLIVE_IMAGE_USER"] or "tex"
		expireProjectAfterIdleMs: 24 * 60 * 60 * 1000
		checkProjectsIntervalMs: 10 * 60 * 1000

	try
		seccomp_profile_path = Path.resolve(__dirname + "/../seccomp/clsi-profile.json")
		module.exports.clsi.docker.seccomp_profile = JSON.stringify(JSON.parse(require("fs").readFileSync(seccomp_profile_path)))
	catch error
		console.log error, "could not load seccom profile from #{seccomp_profile_path}"

	module.exports.path.synctexBaseDir = -> "/compile"	
	
	module.exports.path.sandboxedCompilesHostDir = process.env["COMPILES_HOST_DIR"]

	module.exports.path.synctexBinHostPath = process.env["SYNCTEX_BIN_HOST_PATH"]
