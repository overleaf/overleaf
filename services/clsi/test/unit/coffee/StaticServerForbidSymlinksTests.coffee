should = require('chai').should()
SandboxedModule = require('sandboxed-module')
assert = require('assert')
path = require('path')
sinon = require('sinon')
modulePath = path.join __dirname, "../../../app/js/StaticServerForbidSymlinks"
expect = require("chai").expect

describe "StaticServerForbidSymlinks", ->

	beforeEach ->

		@settings = 
			path:
				compilesDir: "/compiles/here"

		@fs = {}
		@ForbidSymlinks = SandboxedModule.require modulePath, requires:
			"settings-sharelatex":@settings
			"logger-sharelatex": 
				log:->
				warn:->
			"fs":@fs

		@dummyStatic = (rootDir, options) ->
			return (req, res, next) ->
				# console.log "dummyStatic serving file", rootDir, "called with", req.url
				# serve it
				next()

		@StaticServerForbidSymlinks = @ForbidSymlinks @dummyStatic, @settings.path.compilesDir
		@req = 
			params:
				project_id:"12345"

		@res = {}
		@req.url = "/12345/output.pdf"


	describe "sending a normal file through", ->
		beforeEach ->
			@fs.realpath = sinon.stub().callsArgWith(1, null, "#{@settings.path.compilesDir}/#{@req.params.project_id}/output.pdf")

		it "should call next", (done)->
			@res.sendStatus = (resCode)->
				resCode.should.equal 200
				done()
			@StaticServerForbidSymlinks @req, @res, done


	describe "with a missing file", ->
		beforeEach ->
			@fs.realpath = sinon.stub().callsArgWith(1, {code: 'ENOENT'}, "#{@settings.path.compilesDir}/#{@req.params.project_id}/unknown.pdf")

		it "should send a 404", (done)->
			@res.sendStatus = (resCode)->
				resCode.should.equal 404
				done()
			@StaticServerForbidSymlinks @req, @res


	describe "with a symlink file", ->
		beforeEach ->
			@fs.realpath = sinon.stub().callsArgWith(1, null, "/etc/#{@req.params.project_id}/output.pdf")

		it "should send a 404", (done)->
			@res.sendStatus = (resCode)->
				resCode.should.equal 404
				done()
			@StaticServerForbidSymlinks @req, @res

	describe "with an error from fs.realpath", ->

		beforeEach ->
			@fs.realpath = sinon.stub().callsArgWith(1, "error")

		it "should send a 500", (done)->
			@res.sendStatus = (resCode)->
				resCode.should.equal 500
				done()
			@StaticServerForbidSymlinks @req, @res

