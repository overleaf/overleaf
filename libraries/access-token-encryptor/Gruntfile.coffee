spawn = require("child_process").spawn

module.exports = (grunt) ->
	grunt.initConfig
		coffee:
			# app_src:
			# 	expand: true,
			# 	cwd: "app/coffee"
			# 	src: ['**/*.coffee'],
			# 	dest: 'app/js/',
			# 	ext: '.js'

			# app:
			# 	src: "app.coffee"
			# 	dest: "app.js"

			unit_tests:
				expand: true
				cwd:  "test/unit/coffee"
				src: ["**/*.coffee"]
				dest: "test/unit/js/"
				ext:  ".js"

			# acceptance_tests:
			# 	expand: true
			# 	cwd:  "test/acceptance/coffee"
			# 	src: ["**/*.coffee"]
			# 	dest: "test/acceptance/js/"
			# 	ext:  ".js"

		clean:
			app: ["lib/js/"]
			unit_tests: ["test/unit/js"]

		mochaTest:
			unit:
				options:
					reporter: grunt.option('reporter') or 'spec'
					grep: grunt.option("grep")
				src: ["test/unit/js/**/*.js"]

	grunt.loadNpmTasks 'grunt-contrib-coffee'
	grunt.loadNpmTasks 'grunt-contrib-clean'
	grunt.loadNpmTasks 'grunt-mocha-test'
	grunt.loadNpmTasks 'grunt-execute'
	grunt.loadNpmTasks 'grunt-bunyan'

	grunt.registerTask 'compile:unit_tests', ['clean:unit_tests', 'coffee:unit_tests']
	grunt.registerTask 'test:unit',          ['compile:unit_tests', 'mochaTest:unit']

	grunt.registerTask 'compile:acceptance_tests', ['clean:acceptance_tests', 'coffee:acceptance_tests']
	grunt.registerTask 'test:acceptance',          ['compile:acceptance_tests', 'mochaTest:acceptance']

	grunt.registerTask 'install', 'compile:app'

	grunt.registerTask 'default', ['run']
