fs = require "fs"
spawn = require("child_process").spawn
exec = require("child_process").exec
rimraf = require "rimraf"
Path = require "path"
semver = require "semver"
knox = require "knox"

SERVICES = [{
	name: "web"
	repo: "https://github.com/sharelatex/web-sharelatex.git"
}, {
	name: "document-updater"
	repo: "https://github.com/sharelatex/document-updater-sharelatex.git"
}, {
	name: "clsi"
	repo: "https://github.com/sharelatex/clsi-sharelatex.git"
}, {
	name: "filestore"
	repo: "https://github.com/sharelatex/filestore-sharelatex.git"
}]

TRACK_CHANGES =
	name: "track-changes"
	repo: "https://github.com/sharelatex/track-changes-sharelatex.git"


module.exports = (grunt) ->
	grunt.loadNpmTasks 'grunt-bunyan'
	grunt.loadNpmTasks 'grunt-execute'
	grunt.loadNpmTasks 'grunt-available-tasks'
	grunt.loadNpmTasks 'grunt-concurrent'

	execute = {}
	for service in SERVICES.concat([TRACK_CHANGES])
		execute[service.name] =
			src: "#{service.name}/app.js"

	grunt.initConfig
		execute: execute

		concurrent:
			all:
				tasks: ("run:#{service.name}" for service in SERVICES)
				options:
					limit: SERVICES.length
					logConcurrentOutput: true

		availabletasks:
			tasks:
				options:
					filter: 'exclude',
					tasks: [
						'concurrent'
						'execute'
						'bunyan'
						'availabletasks'
						]
					groups:
						"Run tasks": [
							"run"
							"run:all"
							"default"
						].concat ("run:#{service.name}" for service in SERVICES)
						"Misc": [
							"help"
						]
						"Install tasks": ("install:#{service.name}" for service in SERVICES).concat(["install:all", "install", "install:config"])
						"Update tasks": ("update:#{service.name}" for service in SERVICES).concat(["update:all", "update"])
						"Config tasks": ["install:config"]
						"Checks": ["check", "check:redis", "check:latexmk", "check:s3", "check:make"]

	for service in SERVICES.concat([TRACK_CHANGES])
		do (service) ->
			grunt.registerTask "install:#{service.name}", "Download and set up the #{service.name} service", () ->
				done = @async()
				Helpers.installService(service.repo, service.name, done)
			grunt.registerTask "update:#{service.name}", "Checkout and update the #{service.name} service", () ->
				done = @async()
				Helpers.updateService(service.name, done)
			grunt.registerTask "run:#{service.name}", "Run the ShareLaTeX #{service.name} service", ["bunyan", "execute:#{service.name}"]

	grunt.registerTask 'install:config', "Copy the example config into the real config", () ->
		Helpers.installConfig @async()
	grunt.registerTask 'install:all', "Download and set up all ShareLaTeX services",
		["check:make"].concat(
			("install:#{service.name}" for service in SERVICES)
		).concat(["install:config"])
	grunt.registerTask 'install', 'install:all'
	grunt.registerTask 'update:all', "Checkout and update all ShareLaTeX services",
		["check:make"].concat(
			("update:#{service.name}" for service in SERVICES)
		)
	grunt.registerTask 'update', 'update:all'
	grunt.registerTask 'run', "Run all of the sharelatex processes", ['concurrent:all']
	grunt.registerTask 'run:all', 'run'

	grunt.registerTask 'help', 'Display this help list', 'availabletasks'
	grunt.registerTask 'default', 'run'

	grunt.registerTask "check:redis", "Check that redis is installed and running", () ->
		Helpers.checkRedis @async()
	grunt.registerTask "check:latexmk", "Check that latexmk is installed", () ->
		Helpers.checkLatexmk @async()
	grunt.registerTask "check:s3", "Check that Amazon S3 credentials are configured", () ->
		Helpers.checkS3 @async()
	grunt.registerTask "check:make", "Check that make is installed", () ->
		Helpers.checkMake @async()
	grunt.registerTask "check", "Check that you have the required dependencies installed", ["check:redis", "check:latexmk", "check:s3"]

	Helpers =
		installService: (repo_src, dir, callback = (error) ->) ->
			Helpers.cloneGitRepo repo_src, dir, (error) ->
				return callback(error) if error?
				Helpers.installNpmModules dir, (error) ->
					return callback(error) if error?
					Helpers.runGruntInstall dir, (error) ->
						return callback(error) if error?
						callback()

		updateService: (dir, callback = (error) ->) ->
			Helpers.updateGitRepo dir, (error) ->
				return callback(error) if error?
				Helpers.installNpmModules dir, (error) ->
					return callback(error) if error?
					Helpers.runGruntInstall dir, (error) ->
						return callback(error) if error?
						callback()

		cloneGitRepo: (repo_src, dir, callback = (error) ->) ->
			if !fs.existsSync(dir)
				proc = spawn "git", ["clone", repo_src, dir], stdio: "inherit"
				proc.on "close", () ->
					callback()
			else
				console.log "#{dir} already installed, skipping."
				callback()

		updateGitRepo: (dir, callback = (error) ->) ->
			proc = spawn "git", ["checkout", "master"], cwd: dir, stdio: "inherit"
			proc.on "close", () ->
				proc = spawn "git", ["pull"], cwd: dir, stdio: "inherit"
				proc.on "close", () ->
					callback()

		installNpmModules: (dir, callback = (error) ->) ->
			proc = spawn "npm", ["install"], stdio: "inherit", cwd: dir
			proc.on "close", () ->
				callback()

		installConfig: (callback = (error) ->) ->
			if !fs.existsSync("config/settings.development.coffee")
				grunt.log.writeln "Copying example config into config/settings.development.coffee"
				exec "cp config/settings.development.coffee.example config/settings.development.coffee", (error, stdout, stderr) ->
					callback(error)
			else
				grunt.log.writeln "Config file already exists. Skipping."
				callback()

		runGruntInstall: (dir, callback = (error) ->) ->
			proc = spawn "grunt", ["install"], stdio: "inherit", cwd: dir
			proc.on "close", () ->
				callback()

		checkRedis: (callback = (error) ->) ->
			grunt.log.write "Checking Redis is running... "
			exec "redis-cli info", (error, stdout, stderr) ->
				if error? and error.message.match("Could not connect")
					grunt.log.error "FAIL. Redis is not running"
					return callback(error)
				else if error?
					return callback(error)
				else
					m = stdout.match(/redis_version:(.*)/)
					if !m?
						grunt.log.error "FAIL."
						grunt.log.error "Unknown redis version"
						error = new Error("Unknown redis version")
					else
						version = m[1]
						if semver.gt(version, "2.6.0")
							grunt.log.writeln "OK."
							grunt.log.writeln "Running Redis version #{version}"
						else
							grunt.log.error "FAIL."
							grunt.log.error "Redis version is too old (#{version}). Must be 2.6.0 or greater."
							error = new Error("Redis version is too old (#{version}). Must be 2.6.0 or greater.")
				callback(error)

		checkLatexmk: (callback = (error) ->) ->
			grunt.log.write "Checking latexmk is installed... "
			exec "latexmk --version", (error, stdout, stderr) ->
				if error? and error.message.match("command not found")
					grunt.log.error "FAIL."
					grunt.log.errorlns """
					Either latexmk is not installed or is not in your PATH.

					latexmk comes with TexLive 2013, and must be a version from 2013 or later.
					This is a not a fatal error, but compiling will not work without latexmk
					"""
					return callback(error)
				else if error?
					return callback(error)
				else
					m = stdout.match(/Version (.*)/)
					if !m?
						grunt.log.error "FAIL."
						grunt.log.error "Unknown latexmk version"
						error = new Error("Unknown latexmk version")
					else
						version = m[1]
						if semver.gte(version + ".0", "4.39.0")
							grunt.log.writeln "OK."
							grunt.log.writeln "Running latexmk version #{version}"
						else
							grunt.log.error "FAIL."
							grunt.log.errorlns """
							latexmk version is too old (#{version}). Must be 4.39 or greater.
							This is a not a fatal error, but compiling will not work without latexmk
							"""
							error = new Error("latexmk is too old")
				callback(error)

		checkS3: (callback = (error) ->) ->
			grunt.log.write "Checking S3 credentials... "
			Settings = require "settings-sharelatex"
			try
				client = knox.createClient({
					key: Settings.s3.key
					secret: Settings.s3.secret
					bucket: Settings.s3.buckets.user_files
				})
			catch e
				grunt.log.error "FAIL."
				grunt.log.errorlns """
				Please configure your Amazon S3 credentials in config/settings.development.coffee.

				Amazon S3 (Simple Storage Service) is a cloud storage service provided by
				Amazon. ShareLaTeX uses S3 for storing binary files like images. You can 
				sign up for an account and find out more at:

				    http://aws.amazon.com/s3/
                  
				"""
				return callback()

			client.getFile "does-not-exist", (error, response) ->
				unless response? and response.statusCode == 404
					grunt.log.error "FAIL."
					grunt.log.errorlns """
					Could not connect to Amazon S3. Please check your credentials.
					"""
				else
					grunt.log.write "OK."
				callback()

		checkMake: (callback = (error) ->) ->
			grunt.log.write "Checking make is installed... "
			exec "make --version", (error, stdout, stderr) ->
				if error? and error.message.match("command not found")
					grunt.log.error "FAIL."
					grunt.log.errorlns """
					Either make is not installed or is not in your path.

					On Ubuntu you can install make with:

					    sudo apt-get install build-essential

					"""
					return callback(error)
				else if error?
					return callback(error)
				else
					grunt.log.write "OK."
					return callback()




