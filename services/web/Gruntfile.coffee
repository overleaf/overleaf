fs = require "fs"
PackageVersions = require "./app/coffee/infrastructure/PackageVersions"
Settings = require "settings-sharelatex"
require('es6-promise').polyfill()

module.exports = (grunt) ->
	grunt.loadNpmTasks 'grunt-contrib-requirejs'
	grunt.loadNpmTasks 'grunt-file-append'

	config =

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
					generateSourceMaps: true
					preserveLicenseComments: false
					paths:
						"moment": "libs/#{PackageVersions.lib('moment')}"
						"mathjax": "/js/libs/mathjax/MathJax.js?config=TeX-AMS_HTML"
						"pdfjs-dist/build/pdf": "libs/#{PackageVersions.lib('pdfjs')}/pdf"
						"ace": "#{PackageVersions.lib('ace')}"
						"fineuploader": "libs/#{PackageVersions.lib('fineuploader')}"
					shim:
						"pdfjs-dist/build/pdf":
							deps: ["libs/#{PackageVersions.lib('pdfjs')}/compatibility"]

					skipDirOptimize: true
					modules: [
						{
							name: "main",
							exclude: ["libraries"]
						}, {
							name: "ide",
							exclude: ["pdfjs-dist/build/pdf", "libraries"]
						},{
							name: "libraries"
						},{
							name: "ace/mode-latex"
						},{
							name: "ace/worker-latex"
						}

					]

		file_append:
			default_options: files: [ {
				append: '\n//ide.js is complete - used for automated testing'
				input: 'public/minjs/ide.js'
				output: 'public/minjs/ide.js'
			}]

	grunt.initConfig config
	grunt.registerTask 'compile:minify', 'Concat and minify the client side js', ['requirejs', "file_append"]

