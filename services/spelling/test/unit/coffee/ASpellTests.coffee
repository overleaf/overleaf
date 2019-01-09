sinon = require 'sinon'
chai = require 'chai'
should = chai.should()
SandboxedModule = require('sandboxed-module')
assert = require("chai").assert

describe "ASpell", ->
	beforeEach ->
		@ASpell = SandboxedModule.require "../../../app/js/ASpell", requires:
			"logger-sharelatex":
				log:->
				info:->
				err:->
			'metrics-sharelatex':
				gauge:->
				inc: ->

	describe "a correctly spelled word", ->
		beforeEach (done) ->
			@ASpell.checkWords "en", ["word"], (error, @result) => done()

		it "should not correct the word", ->
			@result.length.should.equal 0

	describe "a misspelled word", ->
		beforeEach (done) ->
			@ASpell.checkWords "en", ["bussines"], (error, @result) => done()

		it "should correct the word", ->
			@result.length.should.equal 1
			@result[0].suggestions.indexOf("business").should.not.equal -1

	describe "multiple words", ->
		beforeEach (done) ->
			@ASpell.checkWords "en", ["bussines", "word", "neccesary"], (error, @result) => done()

		it "should correct the incorrect words", ->
			@result[0].index.should.equal 0
			@result[0].suggestions.indexOf("business").should.not.equal -1
			@result[1].index.should.equal 2
			@result[1].suggestions.indexOf("necessary").should.not.equal -1

	describe "without a valid language", ->
		beforeEach (done) ->
			@ASpell.checkWords "notALang", ["banana"], (@error, @result) => done()

		it "should return an error", ->
			should.exist @error

	describe "when there are no suggestions", ->
		beforeEach (done) ->
			@ASpell.checkWords "en", ["asdkfjalkdjfadhfkajsdhfashdfjhadflkjadhflajsd"], (@error, @result) => done()

		it "should return a blank array", ->
			@result.length.should.equal 1
			assert.deepEqual @result[0].suggestions, []

	describe "when the request times out", ->
		beforeEach (done) ->
			words = ("abcdefg" for i in [0..1000])
			@ASpell.ASPELL_TIMEOUT = 1
			@start = Date.now()
			@ASpell.checkWords "en", words, (error, @result) => done()

		# Note that this test fails on OS X, due to differing pipe behaviour
		# on killing the child process. It can be tested successfully on Travis
		# or the CI server.
		it "should return in reasonable time", () ->
			delta = Date.now()-@start
			delta.should.be.below(@ASpell.ASPELL_TIMEOUT + 1000)
