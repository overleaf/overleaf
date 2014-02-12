fs = require "fs"
exec = require("child_process").exec
spawn = require("child_process").spawn

WEB_REPO = "git@bitbucket.org:sharelatex/web-sharelatex.git"
DOC_UPDATER_REPO = "git@bitbucket.org:sharelatex/documentupdater-sharelatex.git"


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

	grunt.registerTask 'install:web', "Download and set up the web-sharelatex service", () ->
		done = @async()
		Helpers.installService(WEB_REPO, "web", done)
	grunt.registerTask 'install:document-updater', "Download and set up the document-updater-sharelatex service", () ->
		done = @async()
		Helpers.installService(DOC_UPDATER_REPO, "document-updater", done)

	grunt.registerTask 'update:web', "Checkout and update the web-sharelatex service", () ->
		done = @async()
		Helpers.updateService("web", done)
	grunt.registerTask 'update:document-updater', "Checkout and update the document-updater-sharelatex service", () ->
		done = @async()
		Helpers.updateService("document-updater", done)
		
	grunt.registerTask 'help', 'Display this help list', 'availabletasks'

	grunt.registerTask 'run:web', "Run web-sharelatex, the ShareLaTeX web server", ["bunyan", "execute:web"]
	grunt.registerTask 'run:document-updater', "Run document-updater-sharelatex, the real-time document server", ["bunyan", "execute:document-updater"]

	grunt.registerTask 'run', "Run all of the sharelatex processes", ['concurrent:all']
	grunt.registerTask 'run:all', 'run'

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
