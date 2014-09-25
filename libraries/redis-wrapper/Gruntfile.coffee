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

			server_tests:
				expand: true,
				flatten: false,
				cwd: 'test/unit/coffee',
				src: ['**/*.coffee'],
				dest: 'test/unit/js/',
				ext: '.js'
	
		mochaTest:
			unit:
				options:
					reporter: process.env.MOCHA_RUNNER || "spec"
					grep: grunt.option("grep")
					require: 'coffee-script/register'
				src: ['test.coffee']


	grunt.loadNpmTasks 'grunt-contrib-coffee'
	grunt.loadNpmTasks 'grunt-mocha-test'

	grunt.registerTask 'test:unit', ['mochaTest:unit']

