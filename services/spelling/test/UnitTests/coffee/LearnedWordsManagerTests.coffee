sinon = require('sinon')
chai = require 'chai'
expect = chai.expect
SandboxedModule = require('sandboxed-module')
modulePath = require('path').join __dirname, '../../../app/js/LearnedWordsManager'

describe "LearnedWordsManager", ->
	beforeEach ->
		@token = "a6b3cd919ge"
		@callback = sinon.stub()
		@db =
			spellingPreferences:
				update: sinon.stub().callsArg(3)
		@cache =
			get: sinon.stub()
			set: sinon.stub()
			break: sinon.stub()
		@LearnedWordsManager = SandboxedModule.require modulePath, requires:
			"./DB" : @db
			"./Cache":@cache


	describe "learnWord", ->
		beforeEach ->
			@word = "instanton"
			@LearnedWordsManager.learnWord @token, @word, @callback

		it "should insert the word in the word list in the database", ->
			expect(
				@db.spellingPreferences.update.calledWith({
					token: @token
				}, {
					$push : learnedWords: @word
				}, {
					upsert: true
				})
			).to.equal true

		it "should call the callback", ->
			expect(@callback.called).to.equal true

	describe "getLearnedWords", ->
		beforeEach ->
			@cache.get.callsArgWith(1)
			@wordList = ["apples", "bananas", "pears"]
			@db.spellingPreferences.findOne = (conditions, callback) =>
				callback null, learnedWords: @wordList
			sinon.spy @db.spellingPreferences, "findOne"
			@LearnedWordsManager.getLearnedWords @token, @callback

		it "should get the word list for the given user", ->
			expect(
				@db.spellingPreferences.findOne.calledWith token: @token
			).to.equal true

		it "should return the word list in the callback", ->
			expect(@callback.calledWith null, @wordList).to.equal true

	###
	describe "caching the result", ->
		it 'should use the cache first if it is primed', (done)->
			@wordList = ["apples", "bananas", "pears"]
			@cache.get.callsArgWith(1, null, learnedWords: @wordList)
			@db.spellingPreferences.findOne = sinon.stub()
			@LearnedWordsManager.getLearnedWords @token, (err, spellings)=>
				@db.spellingPreferences.find.called.should.equal false
				@wordList.should.equal spellings
				done()

		it 'should set the cache after hitting the db', (done)->
			@wordList = ["apples", "bananas", "pears"]
			@cache.get.callsArgWith(1)
			@db.spellingPreferences.findOne = sinon.stub().callsArgWith(1, null, learnedWords: @wordList)
			@LearnedWordsManager.getLearnedWords @token, (err, spellings)=>
				@cache.set.calledWith(@token, learnedWords:@wordList).should.equal true
				done()

		it 'should break cache when update is called', (done)->
			@word = "instanton"
			@LearnedWordsManager.learnWord @token, @word, =>
				@cache.break.calledWith(@token).should.equal true
				done()
	###
