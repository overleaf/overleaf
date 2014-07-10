
should = require('chai').should()
SandboxedModule = require('sandboxed-module')
assert = require('assert')
path = require('path')
sinon = require('sinon')
modulePath = path.join __dirname, "../../../../app/js/Features/Blog/BlogController"
expect = require("chai").expect

describe "BlogController", ->

	beforeEach ->

		@settings =
			apis:
				blog:
					url:"http://blog.sharelatex.env"
		@request = 
			get: sinon.stub()
		@BlogController = SandboxedModule.require modulePath, requires:
			"settings-sharelatex":@settings
			"logger-sharelatex": log:->
			"request": @request

		@req = {}
		@res = {}


	describe "getPage", ()->

		it "should get the data from the blog api", (done)->
			@req.url = "/blog/something.html"
			body = {"stuff":"here"}

			@request.get.callsArgWith(1, null, null, JSON.stringify(body))
			@res.render = (view, data)=>
				@request.get.calledWith("#{@settings.apis.blog.url}#{@req.url}")
				view.should.equal "blog/blog_holder"
				assert.deepEqual body, data
				done()

			@BlogController.getPage @req, @res

		it "should proxy the image urls", (done)->
			@BlogController._directProxy = sinon.stub()
			@req.url = "/something.png"
			@BlogController.getPage @req, @res
			@BlogController._directProxy.calledWith("#{@settings.apis.blog.url}#{@req.url}", @res).should.equal true
			done()


	describe "getIndexPage", ->

		it "should change the url and send it to getPage", (done)->
			@req.url = "/blog"
			@BlogController.getPage = (req, res)->
				req.url.should.equal "/blog/index.html"
				done()
			@BlogController.getIndexPage @req, @res

