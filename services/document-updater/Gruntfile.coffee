module.exports = (grunt) ->
	grunt.loadNpmTasks 'grunt-contrib-coffee'
	grunt.loadNpmTasks 'grunt-contrib-clean'
	grunt.loadNpmTasks 'grunt-mocha-test'
	grunt.loadNpmTasks 'grunt-available-tasks'
	grunt.loadNpmTasks 'grunt-execute'
	grunt.loadNpmTasks 'grunt-bunyan'
	grunt.loadNpmTasks 'grunt-forever'
	
	grunt.initConfig
		forever:
			app:
				options:
					index: "app.js"

		execute:
			app:
				src: "app.js"

		bunyan:
			strict: false

		coffee:
			app_dir: 
				expand: true,
				flatten: false,
				cwd: 'app/coffee',
				src: ['**/*.coffee'],
				dest: 'app/js/',
				ext: '.js'

			app: 
				src: 'app.coffee'
				dest: 'app.js'

			acceptance_tests:
				expand: true,
				flatten: false,
				cwd: 'test/acceptance/coffee',
				src: ['**/*.coffee'],
				dest: 'test/acceptance/js/',
				ext: '.js'

			unit_tests: 
				expand: true,
				flatten: false,
				cwd: 'test/unit/coffee',
				src: ['**/*.coffee'],
				dest: 'test/unit/js/',
				ext: '.js'

		clean:
			app: ["app/js"]
			acceptance_tests: ["test/acceptance/js"]
			unit_tests: ["test/unit/js"]

		mochaTest:
			unit:
				src: ["test/unit/js/#{grunt.option('feature') or '**'}/*.js"]
				options:
					reporter: grunt.option('reporter') or 'spec'
					grep: grunt.option("grep")
			acceptance:
				src: ["test/acceptance/js/#{grunt.option('feature') or '*'}.js"]
				options:
					reporter: grunt.option('reporter') or 'spec'
					grep: grunt.option("grep")
					timeout: 10000

		availabletasks:
			tasks:
				options:
		            filter: 'exclude',
		            tasks: [
		            	'coffee'
		            	'clean'
		            	'mochaTest'
		            	'availabletasks'
		            	'execute'
		            	'bunyan'
		           	]
		            groups:
		            	"Compile tasks": [
		            		"compile:server"
		            		"compile:tests"
		            		"compile"
		            		"compile:unit_tests"
		            		"compile:acceptance_tests"
		            		"install"
		            	]
		            	"Test tasks": [
		            		"test:unit"
		            		"test:acceptance"
		            	]
		            	"Run tasks": [
		            		"run"
		            		"default"
		            	]
		            	"Misc": [
		            		"help"
		            	]

	grunt.registerTask 'help', 'Display this help list', 'availabletasks'

	grunt.registerTask 'compile:server', 'Compile the server side coffee script', ['clean:app', 'coffee:app', 'coffee:app_dir']
	grunt.registerTask 'compile:unit_tests', 'Compile the unit tests', ['clean:unit_tests', 'coffee:unit_tests']
	grunt.registerTask 'compile:acceptance_tests', 'Compile the acceptance tests', ['clean:acceptance_tests', 'coffee:acceptance_tests']
	grunt.registerTask 'compile:tests', 'Compile all the tests', ['compile:acceptance_tests', 'compile:unit_tests']
	grunt.registerTask 'compile', 'Compiles everything need to run document-updater-sharelatex', ['compile:server']

	grunt.registerTask 'install', "Compile everything when installing as an npm module", ['compile']

	grunt.registerTask 'test:unit', 'Run the unit tests (use --grep=<regex> for individual tests)', ['compile:server', 'compile:unit_tests', 'mochaTest:unit']
	grunt.registerTask 'test:acceptance', 'Run the acceptance tests (use --grep=<regex> for individual tests)', ['compile:acceptance_tests', 'mochaTest:acceptance']

	grunt.registerTask 'run', "Compile and run the document-updater-sharelatex server", ['compile', 'bunyan', 'execute']
	grunt.registerTask 'default', 'run'

