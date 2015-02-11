SandboxedModule = require('sandboxed-module')
sinon = require('sinon')
require('chai').should()
modulePath = require('path').join __dirname, '../../../app/js/RequestParser'
tk = require("timekeeper")

describe "RequestParser", ->
	beforeEach ->
		tk.freeze()
		@callback = sinon.stub()
		@validResource =
			path: "main.tex"
			date: "12:00 01/02/03"
			content: "Hello world"
		@validRequest =
			compile:
				token: "token-123"
				options:
					compiler: "pdflatex"
					timeout:  42
				resources: []
		@RequestParser = SandboxedModule.require modulePath
	
	afterEach ->
		tk.reset()

	describe "without a top level object", ->
		beforeEach ->
			@RequestParser.parse [], @callback

		it "should return an error", ->
			@callback.calledWith("top level object should have a compile attribute")
				.should.equal true

	describe "without a compile attribute", ->
		beforeEach ->
			@RequestParser.parse {}, @callback

		it "should return an error", ->
			@callback.calledWith("top level object should have a compile attribute")
				.should.equal true

	describe "without a valid compiler", ->
		beforeEach ->
			@validRequest.compile.options.compiler = "not-a-compiler"
			@RequestParser.parse @validRequest, @callback

		it "should return an error", ->
			@callback.calledWith("compiler attribute should be one of: pdflatex, latex, xelatex, lualatex")
				.should.equal true

	describe "without a compiler specified", ->
		beforeEach ->
			delete @validRequest.compile.options.compiler
			@RequestParser.parse @validRequest, (error, @data) =>
		
		it "should set the compiler to pdflatex by default", ->
			@data.compiler.should.equal "pdflatex"

	describe "without a timeout specified", ->
		beforeEach ->
			delete @validRequest.compile.options.timeout
			@RequestParser.parse @validRequest, (error, @data) =>

		it "should set the timeout to MAX_TIMEOUT", ->
			@data.timeout.should.equal @RequestParser.MAX_TIMEOUT * 1000

	describe "with a timeout larger than the maximum", ->
		beforeEach ->
			@validRequest.compile.options.timeout = @RequestParser.MAX_TIMEOUT + 1
			@RequestParser.parse @validRequest, (error, @data) =>

		it "should set the timeout to MAX_TIMEOUT", ->
			@data.timeout.should.equal @RequestParser.MAX_TIMEOUT * 1000

	describe "with a timeout", ->
		beforeEach ->
			@RequestParser.parse @validRequest, (error, @data) =>

		it "should set the timeout (in milliseconds)", ->
			@data.timeout.should.equal @validRequest.compile.options.timeout * 1000
	
	describe "with a resource without a path", ->
		beforeEach ->
			delete @validResource.path
			@validRequest.compile.resources.push @validResource
			@RequestParser.parse @validRequest, @callback

		it "should return an error", ->
			@callback.calledWith("all resources should have a path attribute")
				.should.equal true

	describe "with a resource with a path", ->
		beforeEach ->
			@validResource.path = @path = "test.tex"
			@validRequest.compile.resources.push @validResource
			@RequestParser.parse @validRequest, @callback
			@data = @callback.args[0][1]

		it "should return the path in the parsed response", ->
			@data.resources[0].path.should.equal @path

	describe "with a resource with a malformed modified date", ->
		beforeEach ->
			@validResource.modified = "not-a-date"
			@validRequest.compile.resources.push @validResource
			@RequestParser.parse @validRequest, @callback

		it "should return an error", ->
			@callback
				.calledWith(
					"resource modified date could not be understood: "+
					@validResource.modified
				)
				.should.equal true

	describe "with a resource with a valid date", ->
		beforeEach ->
			@date = "12:00 01/02/03"
			@validResource.modified = @date
			@validRequest.compile.resources.push @validResource
			@RequestParser.parse @validRequest, @callback
			@data = @callback.args[0][1]

		it "should return the date as a Javascript Date object", ->
			(@data.resources[0].modified instanceof Date).should.equal true
			@data.resources[0].modified.getTime().should.equal Date.parse(@date)

	describe "with a resource without either a content or URL attribute", ->
		beforeEach ->
			delete @validResource.url
			delete @validResource.content
			@validRequest.compile.resources.push @validResource
			@RequestParser.parse @validRequest, @callback

		it "should return an error", ->
			@callback.calledWith("all resources should have either a url or content attribute")
				.should.equal true

	describe "with a resource where the content is not a string", ->
		beforeEach ->
			@validResource.content = []
			@validRequest.compile.resources.push @validResource
			@RequestParser.parse (@validRequest), @callback

		it "should return an error", ->
			@callback.calledWith("content attribute should be a string")
				.should.equal true

	describe "with a resource where the url is not a string", ->
		beforeEach ->
			@validResource.url = []
			@validRequest.compile.resources.push @validResource
			@RequestParser.parse (@validRequest), @callback

		it "should return an error", ->
			@callback.calledWith("url attribute should be a string")
				.should.equal true

	describe "with a resource with a url", ->
		beforeEach ->
			@validResource.url = @url = "www.example.com"
			@validRequest.compile.resources.push @validResource
			@RequestParser.parse (@validRequest), @callback
			@data = @callback.args[0][1]

		it "should return the url in the parsed response", ->
			@data.resources[0].url.should.equal @url
		
	describe "with a resource with a content attribute", ->
		beforeEach ->
			@validResource.content = @content = "Hello world"
			@validRequest.compile.resources.push @validResource
			@RequestParser.parse (@validRequest), @callback
			@data = @callback.args[0][1]

		it "should return the content in the parsed response", ->
			@data.resources[0].content.should.equal @content
		
	describe "without a root resource path", ->
		beforeEach ->
			delete @validRequest.compile.rootResourcePath
			@RequestParser.parse (@validRequest), @callback
			@data = @callback.args[0][1]

		it "should set the root resource path to 'main.tex' by default", ->
			@data.rootResourcePath.should.equal "main.tex"

	describe "with a root resource path", ->
		beforeEach ->
			@validRequest.compile.rootResourcePath = @path = "test.tex"
			@RequestParser.parse (@validRequest), @callback
			@data = @callback.args[0][1]

		it "should return the root resource path in the parsed response", ->
			@data.rootResourcePath.should.equal @path

	describe "with a root resource path that is not a string", ->
		beforeEach ->
			@validRequest.compile.rootResourcePath = []
			@RequestParser.parse (@validRequest), @callback

		it "should return an error", ->
			@callback.calledWith("rootResourcePath attribute should be a string")
				.should.equal true

	describe "with a root resource path that needs escaping", ->
		beforeEach ->
			@validRequest.compile.rootResourcePath = "`rm -rf foo`.tex"
			@RequestParser.parse @validRequest, @callback
			@data = @callback.args[0][1]
			
		it "should return the escaped resource", ->
			@data.rootResourcePath.should.equal "rm -rf foo.tex"
		

