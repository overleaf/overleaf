sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
path = require("path")
modulePath = "../../../../app/js/infrastructure/RedirectManager.js"
SandboxedModule = require('sandboxed-module')

describe "redirectToNewTemplate", ->
	beforeEach ->
		@settings = 
			redirects: 
				"/path/here/" : "/path/elsewhere/"
				"/no/trailing/slash":"/no/trailing/slash/elsewhere"
				"/part/path": "/diff/part/path"
			mountPointUrl:"/here"
		@redirectManager = SandboxedModule.require modulePath, requires:
			"settings-sharelatex":@settings
			"logger-sharelatex":
				log:->
				err:->
		@res = 
			redirect: sinon.stub()
		@req = {}

	describe "redirect", ->

		it "should perminant redirect if url matches redirect", ()->
			@req.url = "/path/here/"
			nextStub = sinon.stub()
			@redirectManager @req, @res, nextStub
			@res.redirect.calledWith(301, "/path/elsewhere/").should.equal true
			nextStub.called.should.equal false
				
		it "should not redirect on non matching url", (done)->
			@req.url = "non/matching/"
			@redirectManager @req, @res, =>
				@res.redirect.called.should.equal false
				done()

		it "should ignore slash at end of url", ->
			@req.url = "/no/trailing/slash/"
			nextStub = sinon.stub()
			@redirectManager @req, @res, nextStub
			@res.redirect.calledWith(301, "/no/trailing/slash/elsewhere").should.equal true
			nextStub.called.should.equal false

