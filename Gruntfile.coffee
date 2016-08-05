fs = require "fs"
spawn = require("child_process").spawn
exec = require("child_process").exec
rimraf = require "rimraf"
Path = require "path"
semver = require "semver"
knox = require "knox"
crypto = require "crypto"
async = require "async"
settings = require("settings-sharelatex")


SERVICES = require("./config/services")

module.exports = (grunt) ->
	grunt.loadNpmTasks 'grunt-bunyan'
	grunt.loadNpmTasks 'grunt-execute'
	grunt.loadNpmTasks 'grunt-available-tasks'
	grunt.loadNpmTasks 'grunt-concurrent'
	grunt.loadNpmTasks "grunt-contrib-coffee"
	grunt.loadNpmTasks "grunt-shell"
	require('load-grunt-config')(grunt)


	execute = {}
	for service in SERVICES
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
		coffee:
			migrate:
				expand: true,
				flatten: false,
				cwd: './',
				src: ['./migrations/*.coffee'],
				dest: './',
				ext: '.js'
				options:
					bare:true

		shell:
			migrate:
				command: "./node_modules/east/bin/east migrate --adapter east-mongo --url #{settings?.mongo?.url}"

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
						"Install tasks": ("install:#{service.name}" for service in SERVICES).concat(["install:all", "install", "install:dirs"])
						"Update tasks": ("update:#{service.name}" for service in SERVICES).concat(["update:all", "update"])
						"Checks": ["check", "check:redis", "check:latexmk", "check:s3", "check:make"]

	for service in SERVICES
		do (service) ->
			grunt.registerTask "install:#{service.name}", "Download and set up the #{service.name} service", () ->
				done = @async()
				Helpers.installService(service, done)



	grunt.registerTask 'install:all', "Download and set up all ShareLaTeX services",
		["check:make"].concat(
			("install:#{service.name}" for service in SERVICES)
		).concat([ "install:dirs"])

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
	grunt.registerTask "check:fs", "Check that local filesystem options are configured", () ->
		Helpers.checkFS @async()
	grunt.registerTask "check:aspell", "Check that aspell is installed", () ->
		Helpers.checkAspell @async()
	grunt.registerTask "check:make", "Check that make is installed", () ->
		Helpers.checkMake @async()

	grunt.registerTask "check", "Check that you have the required dependencies installed", ["check:redis", "check:latexmk", "check:s3", "check:fs", "check:aspell"]



	grunt.registerTask 'migrate', "compile migrations and run them", ['coffee:migrate', 'shell:migrate']


	Helpers =
		installService: (service, callback = (error) ->) ->
			Helpers.cloneGitRepo service, (error) ->
				return callback(error) if error?
				Helpers.installNpmModules service, (error) ->
					return callback(error) if error?
					Helpers.rebuildNpmModules service, (error) ->
						return callback(error) if error?
						Helpers.runGruntInstall service, (error) ->
							return callback(error) if error?
							callback()


		cloneGitRepo: (service, callback = (error) ->) ->
			repo_src = service.repo
			dir = service.name
			if !fs.existsSync(dir)
				proc = spawn "git", [
					"clone",
					repo_src,
					dir
				], stdio: "inherit"
				proc.on "close", () ->
					Helpers.checkoutVersion service, callback
			else
				console.log "#{dir} already installed, skipping."
				callback()

		checkoutVersion: (service, callback = (error) ->) ->
			dir = service.name
			proc = spawn "git", ["checkout", service.version], stdio: "inherit", cwd: dir
			proc.on "close", () ->
				callback()


		installNpmModules: (service, callback = (error) ->) ->
			dir = service.name
			proc = spawn "npm", ["install"], stdio: "inherit", cwd: dir
			proc.on "close", () ->
				callback()

		# work around for https://github.com/npm/npm/issues/5400
		# where binary modules are not built due to bug in npm
		rebuildNpmModules: (service, callback = (error) ->) ->
			dir = service.name
			proc = spawn "npm", ["rebuild"], stdio: "inherit", cwd: dir
			proc.on "close", () ->
				callback()

		runGruntInstall: (service, callback = (error) ->) ->
			dir = service.name
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
						if semver.gte(version, "2.6.12")
							grunt.log.writeln "OK."
							grunt.log.writeln "Running Redis version #{version}"
						else
							grunt.log.error "FAIL."
							grunt.log.error "Redis version is too old (#{version}). Must be 2.6.12 or greater."
							error = new Error("Redis version is too old (#{version}). Must be 2.6.12 or greater.")
				callback(error)

		checkLatexmk: (callback = (error) ->) ->
			grunt.log.write "Checking latexmk is installed... "
			exec "latexmk --version", (error, stdout, stderr) ->
				if error? and error.message.match("not found")
					grunt.log.error "FAIL."
					grunt.log.errorlns """
					Either latexmk is not installed or is not in your PATH.

					latexmk comes with TexLive 2013, and must be a version from 2013 or later.
					If you have already have TeXLive installed, then make sure it is
					included in your PATH (example for 64-bit linux):

						export PATH=$PATH:/usr/local/texlive/2014/bin/x86_64-linux/

					This is a not a fatal error, but compiling will not work without latexmk.
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

		checkAspell: (callback = (error) ->) ->
			grunt.log.write "Checking aspell is installed... "
			exec "aspell dump dicts", (error, stdout, stderr) ->
				if error? and error.message.match("not found")
					grunt.log.error "FAIL."
					grunt.log.errorlns """
					Either aspell is not installed or is not in your PATH.

					On Ubuntu you can install aspell with:

						sudo apt-get install aspell

					Or on a mac:

						brew install aspell

					This is not a fatal error, but the spell-checker will not work without aspell
					"""
					return callback(error)
				else if error?
					return callback(error)
				else
					grunt.log.writeln "OK."
					grunt.log.writeln "The following spell check dictionaries are available:"
					grunt.log.write stdout
					callback()
				callback(error)

		checkS3: (callback = (error) ->) ->
			Settings = require "settings-sharelatex"
			if Settings.filestore.backend==""
				grunt.log.writeln "No backend specified. Assuming Amazon S3"
				Settings.filestore.backend = "s3"
			if Settings.filestore.backend=="s3"
				grunt.log.write "Checking S3 credentials... "
				try
					client = knox.createClient({
						key: Settings.filestore.s3.key
						secret: Settings.filestore.s3.secret
						bucket: Settings.filestore.stores.user_files
					})
				catch e
					grunt.log.error "FAIL."
					grunt.log.errorlns """
					Please configure your Amazon S3 credentials in config/settings.development.coffee

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
						grunt.log.writeln "OK."
					callback()
			else
				grunt.log.writeln "Filestore other than S3 configured. Not checking S3."
				callback()

		checkFS: (callback = (error) ->) ->
			Settings = require "settings-sharelatex"
			if Settings.filestore.backend=="fs"
				grunt.log.write "Checking FS configuration... "
				fs = require("fs")
				fs.exists Settings.filestore.stores.user_files, (exists) ->
					if exists
						grunt.log.writeln "OK."
					else
						grunt.log.error "FAIL."
						grunt.log.errorlns """
						Could not find directory "#{Settings.filestore.stores.user_files}".
						Please check your configuration.
						"""
					callback()
			else
				grunt.log.writeln "Filestore other than FS configured. Not checking FS."
				callback()

		checkMake: (callback = (error) ->) ->
			grunt.log.write "Checking make is installed... "
			exec "make --version", (error, stdout, stderr) ->
				if error? and error.message.match("not found")
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

