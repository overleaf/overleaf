module.exports = (grunt) ->
	grunt.initConfig
		coffee:
			app_src:
				expand: true,
				flatten: true,
				cwd: "app"
				src: ['coffee/*.coffee'],
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

			acceptance_tests:
				expand: true
				cwd:  "test/acceptance/coffee"
				src: ["**/*.coffee"]
				dest: "test/acceptance/js/"
				ext:  ".js"

			smoke_tests:
				expand: true
				cwd:  "test/smoke/coffee"
				src: ["**/*.coffee"]
				dest: "test/smoke/js"
				ext:  ".js"

		watch:
			app:
				files: ['app/coffee/*.coffee']
				tasks: ['coffee']

		clean:
			app: ["app/js/"]
			unit_tests: ["test/unit/js"]
			acceptance_tests: ["test/acceptance/js"]
			smoke_tests: ["test/smoke/js"]

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
					reporter: "spec"
				src: ["test/unit/js/**/*.js"]
			acceptance:
				options:
					reporter: "spec"
					timeout: 40000
				src: ["test/acceptance/js/**/*.js"]
			smoke:
				options:
					reported: "spec"
					timeout: 10000
				src: ["test/smoke/js/**/*.js"]

	grunt.loadNpmTasks 'grunt-contrib-coffee'
	grunt.loadNpmTasks 'grunt-contrib-watch'
	grunt.loadNpmTasks 'grunt-contrib-clean'
	grunt.loadNpmTasks 'grunt-nodemon'
	grunt.loadNpmTasks 'grunt-concurrent'
	grunt.loadNpmTasks 'grunt-mocha-test'
	grunt.loadNpmTasks 'grunt-shell'

	grunt.registerTask 'compile:app', ['clean:app', 'coffee:app', 'coffee:app_src', 'coffee:smoke_tests']
	grunt.registerTask 'run',         ['compile:app', 'concurrent']

	grunt.registerTask 'compile:unit_tests', ['clean:unit_tests', 'coffee:unit_tests']
	grunt.registerTask 'test:unit',          ['compile:app', 'compile:unit_tests', 'mochaTest:unit']

	grunt.registerTask 'compile:acceptance_tests', ['clean:acceptance_tests', 'coffee:acceptance_tests']
	grunt.registerTask 'test:acceptance',          ['compile:acceptance_tests', 'mochaTest:acceptance']

	grunt.registerTask 'compile:smoke_tests', ['clean:smoke_tests', 'coffee:smoke_tests']
	grunt.registerTask 'test:smoke',          ['compile:smoke_tests', 'mochaTest:smoke']

	grunt.registerTask 'install', 'compile:app'

	grunt.registerTask 'default', ['run']


