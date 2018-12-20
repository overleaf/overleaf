/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
module.exports = function(grunt) {

	// Project configuration.
	grunt.initConfig({
		forever: {
			app: {
				options: {
					index: "app.js"
				}
			}
		},

		execute: {
			app: {
				src: "app.js"
			}
		},

		coffee: {
			server: { 
				expand: true,
				flatten: false,
				cwd: 'app/coffee',
				src: ['**/*.coffee'],
				dest: 'app/js/',
				ext: '.js'
			},

			app_server: { 
				expand: true,
				flatten: false,
				src: ['app.coffee'],
				dest: './',
				ext: '.js'
			},

			unit_tests: {
				expand: true,
				flatten: false,
				cwd: 'test/unit/coffee',
				src: ['**/*.coffee'],
				dest: 'test/unit/js/',
				ext: '.js'
			},

			acceptance_tests: {
				expand: true,
				flatten: false,
				cwd: 'test/acceptance/coffee',
				src: ['**/*.coffee'],
				dest: 'test/acceptance/js/',
				ext: '.js'
			}
		},

		watch: {
			server_coffee: {
				files: ['app/**/*.coffee', 'test/unit/**/*.coffee'],
				tasks: ['compile:server', 'compile:unit_tests', 'mochaTest']
			}
		},

		clean: ["app/js", "test/unit/js"],

		nodemon: {
			dev: {
				options: {
					file: 'app.js'
				}
			}
		},

		concurrent: {
			dev: {
				tasks: ['nodemon', 'watch'],
				options: {
					logConcurrentOutput: true
				}
			}
		},

		mochaTest: {
			unit: {
				options: {
					reporter: process.env.MOCHA_RUNNER || "spec",
					grep: grunt.option("grep")
				},
				src: ['test/unit/**/*.js']
			},
			acceptance: {
				options: {
					reporter: process.env.MOCHA_RUNNER || "spec",
					grep: grunt.option("grep")
				},
				src: ['test/acceptance/**/*.js']
			}
		},

		plato: {
			your_task: {
				files: {'plato': ['app/js/**/*.js']}
			}
		}
	});

	grunt.loadNpmTasks('grunt-contrib-coffee');
	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-nodemon');
	grunt.loadNpmTasks('grunt-contrib-clean');
	grunt.loadNpmTasks('grunt-concurrent');
	grunt.loadNpmTasks('grunt-mocha-test');
	grunt.loadNpmTasks('grunt-plato');
	grunt.loadNpmTasks('grunt-execute');
	grunt.loadNpmTasks('grunt-bunyan');
	grunt.loadNpmTasks('grunt-forever');
	

	grunt.registerTask('compile', ['clean', 'coffee']);
	grunt.registerTask('install', ['compile']);
	grunt.registerTask('default', ['compile', 'bunyan', 'execute']);
	grunt.registerTask('test:unit', ['compile', 'mochaTest:unit']);
	return grunt.registerTask('test:acceptance', ['compile:acceptance_tests', 'mochaTest:acceptance']);
};

