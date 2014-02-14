module.exports = (grunt) ->

	# Project configuration.
	grunt.initConfig
		coffee:
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

			server_tests:
				expand: true,
				flatten: false,
				cwd: 'test/unit/coffee',
				src: ['*.coffee', '**/*.coffee'],
				dest: 'test/unit/js/',
				ext: '.js'

		watch:
			server_coffee:
				files: ['app/*.coffee','app/**/*.coffee', 'test/unit/coffee/**/*.coffee', 'test/unit/coffee/*.coffee', "app.coffee"]
				tasks: ["clean", 'coffee', 'mochaTest']

		clean: ["app/js", "test/unit/js", "app.js"]

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
			test:
				options:
					reporter: process.env.MOCHA_RUNNER || "spec"
				src: ['test/*.js', 'test/**/*.js']

	grunt.loadNpmTasks 'grunt-contrib-coffee'
	grunt.loadNpmTasks 'grunt-contrib-watch'
	grunt.loadNpmTasks 'grunt-nodemon'
	grunt.loadNpmTasks 'grunt-contrib-clean'
	grunt.loadNpmTasks 'grunt-concurrent'
	grunt.loadNpmTasks 'grunt-mocha-test'

	grunt.registerTask "ci", ["coffee", "mochaTest"]
	grunt.registerTask 'default', ['coffee', 'concurrent']

	grunt.registerTask "install", "coffee"

