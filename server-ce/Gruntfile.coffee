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
_ = require("underscore")


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
						"Install tasks": ("install:#{service.name}" for service in SERVICES).concat(["install:all", "install"])
						"Update tasks": ("update:#{service.name}" for service in SERVICES).concat(["update:all", "update"])
						"Checks": ["check", "check:redis", "check:latexmk", "check:s3", "check:make", "check:mongo"]

	for service in SERVICES
		do (service) ->
			grunt.registerTask "install:#{service.name}", "Download and set up the #{service.name} service", () ->
				done = @async()
				Helpers.installService(service, done)



	grunt.registerTask 'install:all', "Download and set up all ShareLaTeX services",
		[].concat(
			("install:#{service.name}" for service in SERVICES)
		)

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
		Helpers.checkRedisConnect @async()

	grunt.registerTask "check:mongo", "Check that mongo is installed", () ->
		Helpers.checkMongoConnect @async()

	grunt.registerTask "check", "Check that you have the required dependencies installed", ["check:redis", "check:mongo", "check:make"]

	grunt.registerTask "check:make", "Check that make is installed", () ->
		Helpers.checkMake @async()

	grunt.registerTask 'migrate', "compile migrations and run them", ['coffee:migrate', 'shell:migrate']


	Helpers =
		installService: (service, callback = (error) ->) ->
			console.log "Installing #{service.name}"
			Helpers.cloneGitRepo service, (error) ->
				return callback(error) if error?
				Helpers.installNpmModules service, (error) ->
					return callback(error) if error?
					Helpers.rebuildNpmModules service, (error) ->
						return callback(error) if error?
						Helpers.runGruntInstall service, (error) ->
							return callback(error) if error?
							console.log "Finished installing #{service.name}"
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
		checkMongoConnect: (callback = (error) ->) ->
			grunt.log.write "Checking can connect to mongo"
			mongojs = require("mongojs")
			db = mongojs.connect(settings.mongo.url, ["tags"])
			db.runCommand { ping: 1 }, (err, res) ->
				if !err and res.ok
					grunt.log.write "OK."
				return callback()
			db.on 'error', (err)->
				err = "Can not connect to mongodb"
				grunt.log.error "FAIL."
				grunt.log.errorlns """
				
				ShareLaTeX can not talk to the mongdb instance

				Check the mongodb instance is running and accessible on env var SHARELATEX_MONGO_URL

				"""
				return callback(err)

		checkRedisConnect: (callback = (error) ->) ->
			grunt.log.write "Checking can connect to redis\n"
			rclient = require("redis").createClient(settings.redis.web)

			rclient.ping (err, res) ->
				if !err?
					grunt.log.write "OK."
				else
					throw new Error("hllll")
				return callback()
			errorHandler = _.once (err)->
				err = "Can not connect to redis"
				grunt.log.error "FAIL."
				grunt.log.errorlns """
				
				ShareLaTeX can not talk to the redis instance

				Check the redis instance is running and accessible on env var SHARELATEX_REDIS_URL

				"""
				return callback(err)
			rclient.on 'error', errorHandler
