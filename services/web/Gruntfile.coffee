fs = require "fs"

module.exports = (grunt) ->
	grunt.loadNpmTasks 'grunt-contrib-coffee'
	grunt.loadNpmTasks 'grunt-contrib-less'
	grunt.loadNpmTasks 'grunt-contrib-clean'
	grunt.loadNpmTasks 'grunt-mocha-test'
	grunt.loadNpmTasks 'grunt-available-tasks'
	grunt.loadNpmTasks 'grunt-contrib-requirejs'
	grunt.loadNpmTasks 'grunt-execute'
	grunt.loadNpmTasks 'grunt-bunyan'
	
	grunt.initConfig
		execute:
			app:
				src: "app.js"

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

			TpdsWorker: 
				src: 'TpdsWorker.coffee'
				dest: 'TpdsWorker.js'
				
			BackgroundJobsWorker: 
				src: 'BackgroundJobsWorker.coffee'
				dest: 'BackgroundJobsWorker.js'

			sharejs:
				options:
					join: true
				files:
					"public/js/libs/sharejs.js": [
						"public/coffee/editor/ShareJSHeader.coffee"
						"public/coffee/editor/sharejs/types/helpers.coffee"
						"public/coffee/editor/sharejs/types/text.coffee"
						"public/coffee/editor/sharejs/types/text-api.coffee"
						"public/coffee/editor/sharejs/types/json.coffee"
						"public/coffee/editor/sharejs/types/json-api.coffee"
						"public/coffee/editor/sharejs/client/microevent.coffee"
						"public/coffee/editor/sharejs/client/doc.coffee"
						"public/coffee/editor/sharejs/client/ace.coffee"
					]

			client:
				expand: true,
				flatten: false,
				cwd: 'public/coffee',
				src: ['**/*.coffee'],
				dest: 'public/js/',
				ext: '.js'

			smoke_tests:
				expand: true,
				flatten: false,
				cwd: 'test/smoke/coffee',
				src: ['**/*.coffee'],
				dest: 'test/smoke/js/',
				ext: '.js'

			unit_tests: 
				expand: true,
				flatten: false,
				cwd: 'test/UnitTests/coffee',
				src: ['**/*.coffee'],
				dest: 'test/UnitTests/js/',
				ext: '.js'

		less:
			app:
				files:
					"public/stylesheets/mainStyle.css": "public/stylesheets/mainStyle.less"

		requirejs:
			compile:
				options:
					appDir: "public/js"
					baseUrl: "./"
					dir: "public/minjs"
					inlineText: false
					preserveLicenseComments: false
					paths:
						"underscore": "libs/underscore"
						"jquery": "libs/jquery"
						"moment": "libs/moment"
					shim:
						"libs/backbone":
							deps: ["libs/underscore"]
						"libs/pdfListView/PdfListView":
							deps: ["libs/pdf"]
						"libs/pdf":
							deps: ["libs/compatibility"]

					skipDirOptimize: true
					modules: [
						{
							name: "main",
							exclude: ["jquery"]
						}, {
							name: "ide",
							exclude: ["jquery"]
						}, {
							name: "home",
							exclude: ["jquery"]
						}, {
							name: "list",
							exclude: ["jquery"]
						}
					]

		clean:
			app: ["app/js"]
			unit_tests: ["test/UnitTests/js"]

		mochaTest:
			unit:
				src: ["test/UnitTests/js/#{grunt.option('feature') or '**'}/*.js"]
				options:
					reporter: grunt.option('reporter') or 'spec'
					grep: grunt.option("grep")
			smoke:
				src: ['test/smoke/js/**/*.js']
				options:
					reporter: grunt.option('reporter') or 'spec'
					grep: grunt.option("grep")


		availabletasks:
			tasks:
				options:
		            filter: 'exclude',
		            tasks: [
		            	'coffee'
		            	'less'
		            	'clean'
		            	'mochaTest'
		            	'availabletasks'
		            	'wrap_sharejs'
		            	'requirejs'
		            	'execute'
		            	'bunyan'
		           	]
		            groups:
		            	"Compile tasks": [
		            		"compile:server"
		            		"compile:client"
		            		"compile:tests"
		            		"compile"
		            		"compile:unit_tests"
		            		"compile:smoke_tests"
		            		"compile:css"
		            		"compile:minify"
		            		"install"
		            	]
		            	"Test tasks": [
		            		"test:unit"
		            	]
		            	"Run tasks": [
		            		"run"
		            		"default"
		            	]
		            	"Misc": [
		            		"help"
		            	]

	grunt.registerTask 'wrap_sharejs', 'Wrap the compiled ShareJS code for AMD module loading', () ->
		content = fs.readFileSync "public/js/libs/sharejs.js"
		fs.writeFileSync "public/js/libs/sharejs.js", """
			define(["ace/range"], function() {
				#{content}
				return window.sharejs;
			});
		"""

	grunt.registerTask 'help', 'Display this help list', 'availabletasks'

	grunt.registerTask 'compile:server', 'Compile the server side coffee script', ['clean:app', 'coffee:app', 'coffee:app_dir']
	grunt.registerTask 'compile:client', 'Compile the client side coffee script', ['coffee:client', 'coffee:sharejs', 'wrap_sharejs']
	grunt.registerTask 'compile:css', 'Compile the less files to css', ['less']
	grunt.registerTask 'compile:minify', 'Concat and minify the client side js', ['requirejs']
	grunt.registerTask 'compile:unit_tests', 'Compile the unit tests', ['clean:unit_tests', 'coffee:unit_tests']
	grunt.registerTask 'compile:smoke_tests', 'Compile the smoke tests', ['coffee:smoke_tests']
	grunt.registerTask 'compile:tests', 'Compile all the tests', ['compile:smoke_tests', 'compile:unit_tests']
	grunt.registerTask 'compile', 'Compiles everything need to run web-sharelatex', ['compile:server', 'compile:client', 'compile:css']

	grunt.registerTask 'install', "Compile everything when installing as an npm module", ['compile']

	grunt.registerTask 'test:unit', 'Run the unit tests (use --grep=<regex> or --feature=<feature> for individual tests)', ['compile:server', 'compile:unit_tests', 'mochaTest:unit']
	grunt.registerTask 'test:smoke', 'Run the smoke tests', ['compile:smoke_tests', 'mochaTest:smoke']

	grunt.registerTask 'run', "Compile and run the web-sharelatex server", ['compile', 'bunyan', 'execute']
	grunt.registerTask 'default', 'run'

