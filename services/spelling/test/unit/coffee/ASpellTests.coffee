sinon = require 'sinon'
chai = require 'chai'
should = chai.should()

describe "ASpell", ->
	beforeEach ->
		@ASpell = require("../../../app/js/ASpell")

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
			@result[0].suggestions.should.deep.equal []

	describe "when the request times out", ->
		beforeEach (done) ->
			words = ("abcdefg" for i in [0..1000000])
			@ASpell.ASPELL_TIMEOUT = 100
			@start = new Date()
			@ASpell.checkWords "en", words, (error, @result) => done()

		it "should return in reasonable time", (done) ->
			done()

