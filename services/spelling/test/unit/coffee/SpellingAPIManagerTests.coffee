sinon = require('sinon')
chai = require 'chai'
expect = chai.expect
chai.should()
SandboxedModule = require('sandboxed-module')
modulePath = require('path').join __dirname, '../../../app/js/SpellingAPIManager'

describe "SpellingAPIManager", ->
	beforeEach ->
		@token = "user-id-123"
		@ASpell = {}
		@learnedWords = ["lerned"]
		@LearnedWordsManager =
			getLearnedWords: sinon.stub().callsArgWith(1, null, @learnedWords)
			learnWord: sinon.stub().callsArg(2)

		@SpellingAPIManager = SandboxedModule.require modulePath, requires:
			"./ASpell" : @ASpell
			"./LearnedWordsManager" : @LearnedWordsManager

	describe "runRequest", ->
		beforeEach ->
			@nonLearnedWords = ["some", "words", "htat", "are", "speled", "rong", "lerned"]
			@allWords = @nonLearnedWords.concat(@learnedWords)
			@misspellings = [
				{ index: 2, suggestions: ["that"] }
				{ index: 4, suggestions: ["spelled"] }
				{ index: 5, suggestions: ["wrong", "ring"] }
				{ index: 6, suggestions: ["learned"] }
			]
			@misspellingsWithoutLearnedWords = @misspellings.slice(0,3)

			@ASpell.checkWords = (lang, word, callback) =>
				callback null, @misspellings
			sinon.spy @ASpell, "checkWords"

		describe "with sensible JSON", ->
			beforeEach (done) ->
				@SpellingAPIManager.runRequest @token, words: @allWords, (error, @result) => done()

			it "should return the words that are spelled incorrectly and not learned", ->
				expect(@result.misspellings).to.deep.equal @misspellingsWithoutLearnedWords

		describe "with a missing words array", ->
			beforeEach (done) ->
				@SpellingAPIManager.runRequest @token, {}, (@error, @result) => done()

			it "should return an error", ->
				expect(@error).to.exist
				expect(@error).to.be.instanceof Error
				expect(@error.message).to.equal "malformed JSON"

		describe "with a missing token", ->
			beforeEach (done) ->
				@SpellingAPIManager.runRequest null, words: @allWords, (@error, @result) => done()

			it "should spell check without using any learned words", ->
				@LearnedWordsManager.getLearnedWords.called.should.equal false

		describe "without a language", ->
			beforeEach (done) ->
				@SpellingAPIManager.runRequest @token, words: @allWords, (error, @result) => done()

			it "should use en as the default", ->
				@ASpell.checkWords.calledWith("en").should.equal true

		describe "with a language", ->
			beforeEach (done) ->
				@SpellingAPIManager.runRequest @token, {
					words: @allWords
					language: @language = "fr"
				}, (error, @result) => done()

			it "should use the language", ->
				@ASpell.checkWords.calledWith(@language).should.equal true

		describe "with a very large collection of words", ->
			beforeEach (done) ->
				@manyWords = ("word" for i in [1..100000])
				@SpellingAPIManager.runRequest @token, words: @manyWords, (error, @result) => done()

			it "should truncate to 10,000 words", ->
				@ASpell.checkWords.calledWith(sinon.match.any, @manyWords.slice(0, 10000)).should.equal true

		describe 'with words from the whitelist', ->
			beforeEach (done) ->
				@whitelistWord = @SpellingAPIManager.wordWhitelist[0]
				@words = ["One", @whitelistWord, "Two"]
				@SpellingAPIManager.runRequest @token, words: @words, (error, @result) => done()

			it 'should ignore the white-listed word', ->
				expect(@ASpell.checkWords.lastCall.args[1]).to.deep.equal ["One", "...", "Two"]

	describe "learnWord", ->
		describe "without a token", ->
			beforeEach (done) -> @SpellingAPIManager.learnWord null, word: "banana", (@error) => done()

			it "should return an error", ->
				expect(@error).to.exist
				expect(@error).to.be.instanceof Error
				expect(@error.message).to.equal "no token provided"

		describe "without a word", ->
			beforeEach (done) -> @SpellingAPIManager.learnWord @token, {}, (@error) => done()

			it "should return an error", ->
				expect(@error).to.exist
				expect(@error).to.be.instanceof Error
				expect(@error.message).to.equal "malformed JSON"

		describe "with a word and a token", ->
			beforeEach (done) ->
				@word = "banana"
				@SpellingAPIManager.learnWord @token, word: @word, (@error) => done()

			it "should call LearnedWordsManager.learnWord", ->
				@LearnedWordsManager.learnWord.calledWith(@token, @word).should.equal true
			

