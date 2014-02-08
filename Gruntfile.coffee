module.exports = (grunt) ->
	grunt.loadNpmTasks 'grunt-bunyan'
	grunt.loadNpmTasks 'grunt-execute'
	grunt.loadNpmTasks 'grunt-available-tasks'
	grunt.loadNpmTasks 'grunt-concurrent'

	grunt.initConfig
		execute:
			web:
				src: "node_modules/web-sharelatex/app.js"
			'document-updater':
				src: "node_modules/document-updater-sharelatex/app.js"

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
		            	'coffee'
		            	'execute'
		            	'bunyan'
		            	'availabletasks'
		           	]
		            groups:
		            	"Compile tasks": [
		            		"compile:server"
		            		"compile"
		            	]
		            	"Run tasks": [
		            		"run"
		            		"default"
		            	]
		            	"Misc": [
		            		"help"
		            	]

	grunt.registerTask 'help', 'Display this help list', 'availabletasks'

	grunt.registerTask 'run:web', "Run web-sharelatex, the ShareLaTeX web server", ["bunyan", "execute:web"]
	grunt.registerTask 'run:document-updater', "Run document-updater-sharelatex, the real-time document server", ["bunyan", "execute:document-updater"]

	grunt.registerTask 'run', "Run all of the sharelatex processes", ['concurrent:all']

	grunt.registerTask 'default', 'run'

