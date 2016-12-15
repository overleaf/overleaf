module.exports = (grunt) ->

	# Project configuration.
	grunt.initConfig
		forever:
			app:
				options:
					index: "app.js"

		execute:
			app:
				src: "app.js"

		coffee:
			client: 
				expand: true,
				flatten: false,
				cwd: 'public/coffee',
				src: ['**/*.coffee'],
				dest: 'public/build/',
				ext: '.js'

			server: 
				expand: true,
				flatten: false,
				cwd: 'app/coffee',
				src: ['**/*.coffee'],
				dest: 'app/js/',
				ext: '.js'

			app_server: 
				expand: true,
				flatten: false,
				src: ['app.coffee'],
				dest: './',
				ext: '.js'

			unit_tests:
				expand: true,
				flatten: false,
				cwd: 'test/unit/coffee',
				src: ['**/*.coffee'],
				dest: 'test/unit/js/',
				ext: '.js'

			acceptance_tests:
				expand: true,
				flatten: false,
				cwd: 'test/acceptance/coffee',
				src: ['**/*.coffee'],
				dest: 'test/acceptance/js/',
				ext: '.js'

		watch:
			server_coffee:
				files: ['app/**/*.coffee', 'test/unit/**/*.coffee']
				tasks: ['compile:server', 'compile:unit_tests', 'mochaTest']

			client_coffee:
				files: ['public/**/*.coffee']
				tasks: ['compile']

			less:
				files: ['public/less/*.less']
				tasks: ['compile']

			jade:
				files: ['public/jade/*.jade']
				tasks: ['compile']


		less:
			production:
				files:
					"public/build/css/chat.css": "public/less/chat.less"

		jade:
			compile:
				files:
					"public/build/html/templates.html": ["public/jade/templates.jade"]

		requirejs:
			compile:
				options:
					mainConfigFile: 'public/app.build.js',

		uglify:
			my_target:
				files:
					'public/build/chat.js': ['public/build/chat.js']

		copy:
			main:
				expand: true
				cwd: 'public/js'
				src: '**'
				dest: 'public/build/'

		clean: ["public/build", "app/js", "test/unit/js"]

		nodemon:
			dev:
				options:
					file: 'app.js'

		concurrent:
			dev:
				tasks: ['nodemon', 'watch']
				options:
					logConcurrentOutput: true

		mochaTest:
			unit:
				options:
					reporter: process.env.MOCHA_RUNNER || "spec"
					grep: grunt.option("grep")
				src: ['test/unit/**/*.js']
			acceptance:
				options:
					reporter: process.env.MOCHA_RUNNER || "spec"
					grep: grunt.option("grep")
				src: ['test/acceptance/**/*.js']

		plato:
			your_task:
				files: 'plato': ['app/js/**/*.js'],

	grunt.loadNpmTasks 'grunt-contrib-coffee'
	grunt.loadNpmTasks 'grunt-contrib-watch'
	grunt.loadNpmTasks 'grunt-contrib-copy'
	grunt.loadNpmTasks 'grunt-contrib-less'
	grunt.loadNpmTasks 'grunt-contrib-jade'
	grunt.loadNpmTasks 'grunt-contrib-requirejs'
	grunt.loadNpmTasks 'grunt-contrib-uglify'
	grunt.loadNpmTasks 'grunt-nodemon'
	grunt.loadNpmTasks 'grunt-contrib-clean'
	grunt.loadNpmTasks 'grunt-concurrent'
	grunt.loadNpmTasks 'grunt-mocha-test'
	grunt.loadNpmTasks 'grunt-plato'
	grunt.loadNpmTasks 'grunt-execute'
	grunt.loadNpmTasks 'grunt-bunyan'
	grunt.loadNpmTasks 'grunt-forever'
	

	grunt.registerTask 'compile', ['clean',  'copy', 'coffee', 'less', 'jade', 'requirejs']
	grunt.registerTask 'install', ['compile']
	grunt.registerTask 'default', ['compile', 'bunyan', 'execute']
	grunt.registerTask 'compileAndCompress', ['compile', 'uglify']
	grunt.registerTask 'test:unit', ['compile', 'mochaTest:unit']
	grunt.registerTask 'test:acceptance', ['compile:acceptance_tests', 'mochaTest:acceptance']

