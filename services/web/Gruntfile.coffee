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
				
			BackgroundJobsWorker: 
				src: 'BackgroundJobsWorker.coffee'
				dest: 'BackgroundJobsWorker.js'

			sharejs:
				options:
					join: true
				files:
					"public/js/libs/sharejs.js": [
						"public/coffee/ide/editor/sharejs/header.coffee"
						"public/coffee/ide/editor/sharejs/vendor/types/helpers.coffee"
						"public/coffee/ide/editor/sharejs/vendor/types/text.coffee"
						"public/coffee/ide/editor/sharejs/vendor/types/text-api.coffee"
						"public/coffee/ide/editor/sharejs/vendor/client/microevent.coffee"
						"public/coffee/ide/editor/sharejs/vendor/client/doc.coffee"
						"public/coffee/ide/editor/sharejs/vendor/client/ace.coffee"
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
					"public/stylesheets/style.css": "public/stylesheets/style.less"

		requirejs:
			compile:
				options:
					optimize:"uglify2"
					uglify2:
						mangle: false
					appDir: "public/js"
					baseUrl: "./"
					dir: "public/minjs"
					inlineText: false
					preserveLicenseComments: false
					paths:
						"moment": "libs/moment-2.7.0"
						"mathjax": "https://cdn.mathjax.org/mathjax/latest/MathJax.js?config=TeX-AMS_HTML"
					shim:
						"libs/pdfListView/PdfListView":
							deps: ["libs/pdf"]
						"libs/pdf":
							deps: ["libs/compatibility"]

					skipDirOptimize: true
					modules: [
						{
							name: "main",
							exclude: ["libs"]
						}, {
							name: "ide",
							exclude: ["libs", "libs/jquery-layout"]
						}, {
							name: "libs"
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
			define(["ace/ace"], function() {
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

