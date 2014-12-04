should = require('chai').should()
SandboxedModule = require('sandboxed-module')
assert = require('assert')
path = require('path')
sinon = require('sinon')
modulePath = path.join __dirname, "../../../app/js/SymlinkCheckerMiddlewear"
expect = require("chai").expect

describe "SymlinkCheckerMiddlewear", ->

	beforeEach ->

		@settings = 
			path:
				compilesDir: "/compiles/here"

		@fs = {}
		@SymlinkCheckerMiddlewear = SandboxedModule.require modulePath, requires:
			"settings-sharelatex":@settings
			"logger-sharelatex": 
				log:->
				warn:->
			"fs":@fs
		@req = 
			params:
				project_id:"12345"

		@res = {}
		@req.params[0]= "output.pdf"


	describe "sending a normal file through", ->
		beforeEach ->
			@fs.realpath = sinon.stub().callsArgWith(1, null, "#{@settings.path.compilesDir}/#{@req.params.project_id}/output.pdf")

		it "should call next", (done)->
			@SymlinkCheckerMiddlewear @req, @res, done


	describe "with a symlink file", ->
		beforeEach ->
			@fs.realpath = sinon.stub().callsArgWith(1, null, "/etc/#{@req.params.project_id}/output.pdf")

		it "should send a 404", (done)->
			@res.send = (resCode)->
				resCode.should.equal 404
				done()
			@SymlinkCheckerMiddlewear @req, @res

	describe "with an error from fs.realpath", ->

		beforeEach ->
			@fs.realpath = sinon.stub().callsArgWith(1, "error")

		it "should send a 500", (done)->
			@res.send = (resCode)->
				resCode.should.equal 500
				done()
			@SymlinkCheckerMiddlewear @req, @res

