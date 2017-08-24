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
			storage: Path.resolve(__dirname + "/../db.sqlite")

	path:
		compilesDir:  Path.resolve(__dirname + "/../compiles")
		clsiCacheDir: Path.resolve(__dirname + "/../cache")
		synctexBaseDir: (project_id) -> Path.join(@compilesDir, project_id)

#	clsi:
#		commandRunner: "docker-runner-sharelatex"
#		docker:
#			image: "quay.io/sharelatex/texlive-full:2017.1"
#			env:
#				HOME: "/tmp"
#			socketPath: "/var/run/docker.sock"
#			user: "tex"
#		expireProjectAfterIdleMs: 24 * 60 * 60 * 1000
#		checkProjectsIntervalMs: 10 * 60 * 1000

	internal:
		clsi:
			port: 3013
			host: "localhost"

	
	apis:
		clsi:
			url: "http://localhost:3013"
			
	smokeTest: false
	project_cache_length_ms: 1000 * 60 * 60 * 24
	parallelFileDownloads:1
