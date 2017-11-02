sinon = require('sinon')
chai = require 'chai'
expect = chai.expect
SandboxedModule = require('sandboxed-module')
modulePath = require('path').join __dirname, '../../../app/js/LearnedWordsManager'
assert = require("chai").assert
should = require("chai").should()
describe "LearnedWordsManager", ->
	beforeEach ->
		@token = "a6b3cd919ge"
		@callback = sinon.stub()
		@db =
			spellingPreferences:
				update: sinon.stub().callsArg(3)
		@cache = 
			get:sinon.stub()
			set:sinon.stub()
			del:sinon.stub()
		@LearnedWordsManager = SandboxedModule.require modulePath, requires:
			"./DB" : @db
			"./MongoCache":@cache
			"logger-sharelatex":
				log:->
				err:->
				info:->
			'metrics-sharelatex': {timeAsyncMethod: sinon.stub(), inc: sinon.stub()}

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

	
	describe "caching the result", ->
		it 'should use the cache first if it is primed', (done)->
			@wordList = ["apples", "bananas", "pears"]
			@cache.get.returns(@wordList)
			@db.spellingPreferences.findOne = sinon.stub()
			@LearnedWordsManager.getLearnedWords @token, (err, spellings)=>
				@db.spellingPreferences.findOne.called.should.equal false
				assert.deepEqual @wordList, spellings
				done()

		it 'should set the cache after hitting the db', (done)->
			@wordList = ["apples", "bananas", "pears"]
			@db.spellingPreferences.findOne = sinon.stub().callsArgWith(1, null, learnedWords: @wordList)
			@LearnedWordsManager.getLearnedWords @token, (err, spellings)=>
				@cache.set.calledWith(@token, @wordList).should.equal true
				done()

		it 'should break cache when update is called', (done)->
			@word = "instanton"
			@LearnedWordsManager.learnWord @token, @word, =>
				@cache.del.calledWith(@token).should.equal true
				done()


	describe "deleteUsersLearnedWords", ->
		beforeEach ->
			@db.spellingPreferences.remove = sinon.stub().callsArgWith(1)


		it "should get the word list for the given user", (done)->
			@LearnedWordsManager.deleteUsersLearnedWords @token, =>
				@db.spellingPreferences.remove.calledWith(token: @token).should.equal true
				done()

