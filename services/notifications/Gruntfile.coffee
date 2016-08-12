module.exports = (grunt) ->
	grunt.initConfig
		coffee:
			app_src:
				expand: true,
				cwd: "app/coffee"
				src: ['**/*.coffee'],
				dest: 'app/js/',
				ext: '.js'

			app:
				src: "app.coffee"
				dest: "app.js"

			unit_tests:
				expand: true
				cwd:  "test/unit/coffee"
				src: ["**/*.coffee"]
				dest: "test/unit/js/"
				ext:  ".js"

		clean:
			app: ["app/js/"]
			unit_tests: ["test/unit/js"]

		execute:
			app:
				src: "app.js"

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

	grunt.registerTask 'compile:app', ['clean:app', 'coffee:app', 'coffee:app_src']
	grunt.registerTask 'run',         ['compile:app', 'bunyan', 'execute']

	grunt.registerTask 'compile:unit_tests', ['clean:unit_tests', 'coffee:unit_tests']
	grunt.registerTask 'test:unit',          ['compile:app', 'compile:unit_tests', 'mochaTest:unit']

	grunt.registerTask 'install', 'compile:app'

	grunt.registerTask 'default', ['run']


