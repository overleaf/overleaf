fs = require "fs"
exec = require("child_process").exec
spawn = require("child_process").spawn

SERVICES = [{
	name: "web"
	repo: "git@github.com:sharelatex/web-sharelatex.git"
}, {
	name: "document-updater"
	repo: "git@github.com:sharelatex/document-updater-sharelatex.git"
}]


module.exports = (grunt) ->
	grunt.loadNpmTasks 'grunt-bunyan'
	grunt.loadNpmTasks 'grunt-execute'
	grunt.loadNpmTasks 'grunt-available-tasks'
	grunt.loadNpmTasks 'grunt-concurrent'

	grunt.initConfig
		execute:
			web:
				src: "web/app.js"
			'document-updater':
				src: "document-updater/app.js"

		concurrent:
			all:
				tasks: ['run:web', 'run:document-updater']
				options:
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
							"run:web"
							"run:document-updater"
							"default"
						]
						"Misc": [
							"help"
						]
						"Install tasks": ("install:#{service.name}" for service in SERVICES).concat("install:all")
						"Update tasks": ("update:#{service.name}" for service in SERVICES).concat("update:all")

	for service in SERVICES
		do (service) ->
			grunt.registerTask "install:#{service.name}", "Download and set up the #{service.name} service", () ->
				done = @async()
				Helpers.installService(service.repo, service.name, done)
			grunt.registerTask "update:#{service.name}", "Checkout and update the #{service.name} service", () ->
				done = @async()
				Helpers.updateService(service.name, done)
			grunt.registerTask 'run:#{service.name}', "Run the ShareLaTeX #{service.name} service", ["bunyan", "execute:web"]

	grunt.registerTask 'install:all', "Download and set up all ShareLaTeX services", ("install:#{service.name}" for service in SERVICES)
	grunt.registerTask 'install', 'install:all'
	grunt.registerTask 'update:all', "Checkout and update all ShareLaTeX services", ("update:#{service.name}" for service in SERVICES)
	grunt.registerTask 'update', 'update:all'
	grunt.registerTask 'run', "Run all of the sharelatex processes", ['concurrent:all']
	grunt.registerTask 'run:all', 'run'

	grunt.registerTask 'help', 'Display this help list', 'availabletasks'
	grunt.registerTask 'default', 'run'

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

	runGruntInstall: (dir, callback = (error) ->) ->
		proc = spawn "grunt", ["install"], stdio: "inherit", cwd: dir
		proc.on "close", () ->
			callback()
