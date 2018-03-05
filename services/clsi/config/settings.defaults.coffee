Path = require "path"

module.exports =
	# Options are passed to Sequelize.
	# See http://sequelizejs.com/documentation#usage-options for details
	mysql:
		clsi:
			database: "clsi"
			username: "clsi"
			password: null
			dialect: "sqlite"
			storage: process.env["SQLITE_PATH"] or Path.resolve(__dirname + "/../db.sqlite")

	path:
		compilesDir:  Path.resolve(__dirname + "/../compiles")
		clsiCacheDir: Path.resolve(__dirname + "/../cache")
		synctexBaseDir: (project_id) -> Path.join(@compilesDir, project_id)

	internal:
		clsi:
			port: 3013
			host: process.env["LISTEN_ADDRESS"] or "localhost"

	apis:
		clsi:
			url: "http://#{process.env['CLSI_HOST'] or 'localhost'}:3013"
			
	smokeTest: false
	project_cache_length_ms: 1000 * 60 * 60 * 24
	parallelFileDownloads:1

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

	module.exports.path.synctexBaseDir = -> "/compile"	
	
	module.exports.path.sandboxedCompilesHostDir = process.env["COMPILES_HOST_DIR"]

	module.exports.path.synctexBinHostPath = process.env["SYNCTEX_BIN_HOST_PATH"]
