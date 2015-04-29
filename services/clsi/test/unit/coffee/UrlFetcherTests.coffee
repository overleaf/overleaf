SandboxedModule = require('sandboxed-module')
sinon = require('sinon')
require('chai').should()
modulePath = require('path').join __dirname, '../../../app/js/UrlFetcher'
EventEmitter = require("events").EventEmitter

describe "UrlFetcher", ->
	beforeEach ->
		@callback = sinon.stub()
		@url = "www.example.com/file"
		@UrlFetcher = SandboxedModule.require modulePath, requires:
			request: defaults: @defaults = sinon.stub().returns(@request = {})
			fs: @fs = {}
			"logger-sharelatex": @logger = { log: sinon.stub(), error: sinon.stub() }

	it "should turn off the cookie jar in request", ->
		@defaults.calledWith(jar: false)
			.should.equal true
		
	describe "_pipeUrlToFile", ->
		beforeEach ->
			@path = "/path/to/file/on/disk"
			@request.get = sinon.stub().returns(@urlStream = new EventEmitter)
			@urlStream.pipe = sinon.stub()
			@fs.createWriteStream = sinon.stub().returns(@fileStream = { on: () -> })
			@fs.unlink = (file, callback) -> callback()
			@UrlFetcher.pipeUrlToFile(@url, @path, @callback)

		it "should request the URL", ->
			@request.get
				.calledWith(@url)
				.should.equal true

		it "should open the file for writing", ->
			@fs.createWriteStream
				.calledWith(@path)
				.should.equal true

		describe "successfully", ->
			beforeEach ->
				@res = statusCode: 200
				@urlStream.emit "response", @res
				@urlStream.emit "end"

			it "should pipe the URL to the file", ->
				@urlStream.pipe
					.calledWith(@fileStream)
					.should.equal true
		
			it "should call the callback", ->
				@callback.called.should.equal true

		describe "with non success status code", ->
			beforeEach ->
				@res = statusCode: 404
				@urlStream.emit "response", @res
				@urlStream.emit "end"

			it "should call the callback with an error", ->
				@callback
					.calledWith(new Error("URL returned non-success status code: 404"))
					.should.equal true

		describe "with error", ->
			beforeEach ->
				@urlStream.emit "error", @error = new Error("something went wrong")

			it "should call the callback with the error", ->
				@callback
					.calledWith(@error)
					.should.equal true

			it "should only call the callback once, even if end is called", ->
				@urlStream.emit "end"
				@callback.calledOnce.should.equal true

