SandboxedModule = require('sandboxed-module')
sinon = require('sinon')
require('chai').should()
modulePath = require('path').join __dirname, '../../../app/js/OutputFileFinder'
path = require "path"
expect = require("chai").expect
EventEmitter = require("events").EventEmitter

describe "OutputFileFinder", ->
	beforeEach ->
		@OutputFileFinder = SandboxedModule.require modulePath, requires:
			"fs": @fs = {}
			"child_process": spawn: @spawn = sinon.stub()
			"logger-sharelatex": { log: sinon.stub() }
		@directory = "/test/dir"
		@callback = sinon.stub()

	describe "findOutputFiles", ->
		beforeEach ->
			@resource_path = "resource/path.tex"
			@output_paths   = ["output.pdf", "extra/file.tex"]
			@all_paths = @output_paths.concat [@resource_path]
			@resources = [
				path: @resource_path = "resource/path.tex"
			]
			@OutputFileFinder._getAllFiles = sinon.stub().callsArgWith(1, null, @all_paths)
			@OutputFileFinder.findOutputFiles @resources, @directory, (error, @outputFiles) =>

		it "should only return the output files, not directories or resource paths", ->
			expect(@outputFiles).to.deep.equal [{
				path: "output.pdf"
				type: "pdf"
			}, {
				path: "extra/file.tex",
				type: "tex"
			}]
			
	describe "_getAllFiles", ->
		beforeEach ->
			@proc = new EventEmitter()
			@proc.stdout = new EventEmitter()
			@spawn.returns @proc
			@directory = "/base/dir"
			@OutputFileFinder._getAllFiles @directory, @callback
			
			@proc.stdout.emit(
				"data",
				["/base/dir/main.tex", "/base/dir/chapters/chapter1.tex"].join("\n") + "\n"
			)
			@proc.emit "close", 0
			
		it "should call the callback with the relative file paths", ->
			@callback.calledWith(
				null,
				["main.tex", "chapters/chapter1.tex"]
			).should.equal true
	
