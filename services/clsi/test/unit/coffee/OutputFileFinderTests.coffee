SandboxedModule = require('sandboxed-module')
sinon = require('sinon')
require('chai').should()
modulePath = require('path').join __dirname, '../../../app/js/OutputFileFinder'
path = require "path"
expect = require("chai").expect

describe "OutputFileFinder", ->
	beforeEach ->
		@OutputFileFinder = SandboxedModule.require modulePath, requires:
			"fs": @fs = {}
			"wrench": @wrench = {}
		@directory = "/test/dir"
		@callback = sinon.stub()

	describe "findOutputFiles", ->
		beforeEach ->
			@resource_path = "resource/path.tex"
			@output_paths   = ["output.pdf", "extra", "extra/file.tex"]
			@resources = [
				path: @resource_path = "resource/path.tex"
			]
			@OutputFileFinder._isDirectory = (dirPath, callback = (error, directory) ->) =>
				callback null, dirPath == path.join(@directory, "extra")

			@wrench.readdirRecursive = (dir, callback) =>
				callback(null, [@resource_path].concat(@output_paths))
				callback(null, null)
			sinon.spy @wrench, "readdirRecursive"
			@OutputFileFinder.findOutputFiles @resources, @directory, (error, @outputFiles) =>

		it "should only return the output files, not directories or resource paths", ->
			expect(@outputFiles).to.deep.equal [{
				path: "output.pdf"
				type: "pdf"
			}, {
				path: "extra/file.tex",
				type: "tex"
			}]

	
