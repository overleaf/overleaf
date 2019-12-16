
assert = require("chai").assert
sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../app/js/KeyBuilder.js"
SandboxedModule = require('sandboxed-module')

describe "LocalFileWriter", ->

	beforeEach ->

		@keyBuilder = SandboxedModule.require modulePath, requires:
			"logger-sharelatex":
				log:->
				err:->
		@key = "123/456"
		
	describe "cachedKey", ->

		it "should add the fomat on", ->
			opts =
				format: "png"
			newKey = @keyBuilder.addCachingToKey @key, opts
			newKey.should.equal "#{@key}-converted-cache/format-png"

		it "should add the style on", ->
			opts =
				style: "thumbnail"
			newKey = @keyBuilder.addCachingToKey @key, opts
			newKey.should.equal "#{@key}-converted-cache/style-thumbnail"

		it "should add format on first", ->
			opts =
				style: "thumbnail"
				format: "png"
			newKey = @keyBuilder.addCachingToKey @key, opts
			newKey.should.equal "#{@key}-converted-cache/format-png-style-thumbnail"
