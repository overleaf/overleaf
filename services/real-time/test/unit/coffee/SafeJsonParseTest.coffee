require('chai').should()
expect = require("chai").expect
SandboxedModule = require('sandboxed-module')
modulePath = '../../../app/js/SafeJsonParse'
sinon = require("sinon")

describe 'SafeJsonParse', ->
	beforeEach ->
		@SafeJsonParse = SandboxedModule.require modulePath, requires:
			"settings-sharelatex": @Settings = {
				maxUpdateSize: 16 * 1024
			}
			"logger-sharelatex": @logger = {error: sinon.stub()}

	describe "parse", ->
		it "should parse documents correctly", (done) ->
			@SafeJsonParse.parse '{"foo": "bar"}', (error, parsed) ->
				expect(parsed).to.deep.equal {foo: "bar"}
				done()
		
		it "should return an error on bad data", (done) ->
			@SafeJsonParse.parse 'blah', (error, parsed) ->
				expect(error).to.exist
				done()
		
		it "should return an error on oversized data", (done) ->
			# we have a 2k overhead on top of max size
			big_blob = Array(16*1024).join("A")
			data = "{\"foo\": \"#{big_blob}\"}"
			@Settings.maxUpdateSize = 2 * 1024
			@SafeJsonParse.parse data, (error, parsed) =>
				@logger.error.called.should.equal true
				expect(error).to.exist
				done()