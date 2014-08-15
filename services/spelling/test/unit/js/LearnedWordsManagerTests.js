(function() {
  var SandboxedModule, chai, expect, modulePath, sinon;

  sinon = require('sinon');

  chai = require('chai');

  expect = chai.expect;

  SandboxedModule = require('sandboxed-module');

  modulePath = require('path').join(__dirname, '../../../app/js/LearnedWordsManager');

  describe("LearnedWordsManager", function() {
    beforeEach(function() {
      this.token = "a6b3cd919ge";
      this.callback = sinon.stub();
      this.db = {
        spellingPreferences: {
          update: sinon.stub().callsArg(3)
        }
      };
      return this.LearnedWordsManager = SandboxedModule.require(modulePath, {
        requires: {
          "./DB": this.db
        }
      });
    });
    describe("learnWord", function() {
      beforeEach(function() {
        this.word = "instanton";
        return this.LearnedWordsManager.learnWord(this.token, this.word, this.callback);
      });
      it("should insert the word in the word list in the database", function() {
        return expect(this.db.spellingPreferences.update.calledWith({
          token: this.token
        }, {
          $push: {
            learnedWords: this.word
          }
        }, {
          upsert: true
        })).to.equal(true);
      });
      return it("should call the callback", function() {
        return expect(this.callback.called).to.equal(true);
      });
    });
    return describe("getLearnedWords", function() {
      beforeEach(function() {
        this.wordList = ["apples", "bananas", "pears"];
        this.db.spellingPreferences.findOne = (function(_this) {
          return function(conditions, callback) {
            return callback(null, {
              learnedWords: _this.wordList
            });
          };
        })(this);
        sinon.spy(this.db.spellingPreferences, "findOne");
        return this.LearnedWordsManager.getLearnedWords(this.token, this.callback);
      });
      it("should get the word list for the given user", function() {
        return expect(this.db.spellingPreferences.findOne.calledWith({
          token: this.token
        })).to.equal(true);
      });
      return it("should return the word list in the callback", function() {
        return expect(this.callback.calledWith(null, this.wordList)).to.equal(true);
      });
    });

    /*
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
     */
  });

}).call(this);
