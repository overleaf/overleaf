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
	
	config =
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

	moduleCompileServerTasks = []
	moduleCompileUnitTestTasks = []
	moduleUnitTestTasks = []
	moduleCompileClientTasks = []
	moduleIdeClientSideIncludes = []
	if fs.existsSync "./modules"
		for module in fs.readdirSync "./modules"
			if fs.existsSync "./modules/#{module}/index.coffee"
				config.coffee["module_#{module}_server"] = {
					expand: true,
					flatten: false,
					cwd: "modules/#{module}/app/coffee",
					src: ['**/*.coffee'],
					dest: "modules/#{module}/app/js",
					ext: '.js'
				}
				config.coffee["module_#{module}_index"] = {
					src: "modules/#{module}/index.coffee",
					dest: "modules/#{module}/index.js"
				}
				
				moduleCompileServerTasks.push "coffee:module_#{module}_server"
				moduleCompileServerTasks.push "coffee:module_#{module}_index"
				
				config.coffee["module_#{module}_unit_tests"] = {
					expand: true,
					flatten: false,
					cwd: "modules/#{module}/test/unit/coffee",
					src: ['**/*.coffee'],
					dest: "modules/#{module}/test/unit/js",
					ext: '.js'
				}
				config.mochaTest["module_#{module}_unit"] = {
					src: ["modules/#{module}/test/unit/js/*.js"]
					options:
						reporter: grunt.option('reporter') or 'spec'
						grep: grunt.option("grep")
				}
				
				moduleCompileUnitTestTasks.push "coffee:module_#{module}_unit_tests"
				moduleUnitTestTasks.push "mochaTest:module_#{module}_unit"
				
				config.coffee["module_#{module}_client_ide"] = {
					expand: true,
					flatten: false,
					cwd: "modules/#{module}/public/coffee/ide",
					src: ['**/*.coffee'],
					dest: "public/js/ide/#{module}",
					ext: '.js'
				}
				moduleCompileClientTasks.push "coffee:module_#{module}_client_ide"
				moduleIdeClientSideIncludes.push "ide/#{module}/index"
	
	grunt.initConfig config

	grunt.registerTask 'wrap_sharejs', 'Wrap the compiled ShareJS code for AMD module loading', () ->
		content = fs.readFileSync "public/js/libs/sharejs.js"
		fs.writeFileSync "public/js/libs/sharejs.js", """
			define(["ace/ace"], function() {
				#{content}
				return window.sharejs;
			});
		"""

	grunt.registerTask 'help', 'Display this help list', 'availabletasks'

	grunt.registerTask 'compile:modules:server', 'Compile all the modules', moduleCompileServerTasks
	grunt.registerTask 'compile:modules:unit_tests', 'Compile all the modules unit tests', moduleCompileUnitTestTasks
	grunt.registerTask 'compile:modules:client', 'Compile all the module client side code', moduleCompileClientTasks
	grunt.registerTask 'compile:modules:inject_clientside_includes', () ->
		content = fs.readFileSync("public/js/ide.js").toString()
		content = content.replace(/"__IDE_CLIENTSIDE_INCLUDES__"/g, moduleIdeClientSideIncludes.map((i) -> "\"#{i}\"").join(", "))
		fs.writeFileSync "public/js/ide.js", content
	
	grunt.registerTask 'compile:server', 'Compile the server side coffee script', ['clean:app', 'coffee:app', 'coffee:app_dir', 'compile:modules:server']
	grunt.registerTask 'compile:client', 'Compile the client side coffee script', ['coffee:client', 'coffee:sharejs', 'wrap_sharejs', "compile:modules:client", 'compile:modules:inject_clientside_includes']
	grunt.registerTask 'compile:css', 'Compile the less files to css', ['less']
	grunt.registerTask 'compile:minify', 'Concat and minify the client side js', ['requirejs']
	grunt.registerTask 'compile:unit_tests', 'Compile the unit tests', ['clean:unit_tests', 'coffee:unit_tests']
	grunt.registerTask 'compile:smoke_tests', 'Compile the smoke tests', ['coffee:smoke_tests']
	grunt.registerTask 'compile:tests', 'Compile all the tests', ['compile:smoke_tests', 'compile:unit_tests']
	grunt.registerTask 'compile', 'Compiles everything need to run web-sharelatex', ['compile:server', 'compile:client', 'compile:css']

	grunt.registerTask 'install', "Compile everything when installing as an npm module", ['compile']

	grunt.registerTask 'test:unit', 'Run the unit tests (use --grep=<regex> or --feature=<feature> for individual tests)', ['compile:server', 'compile:unit_tests', 'mochaTest:unit']
	grunt.registerTask 'test:smoke', 'Run the smoke tests', ['compile:smoke_tests', 'mochaTest:smoke']
	
	grunt.registerTask 'test:modules:unit', 'Run the unit tests for the modules', ['compile:modules:server', 'compile:modules:unit_tests'].concat(moduleUnitTestTasks)

	grunt.registerTask 'run', "Compile and run the web-sharelatex server", ['compile', 'bunyan', 'execute']
	grunt.registerTask 'default', 'run'

