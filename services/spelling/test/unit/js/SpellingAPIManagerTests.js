(function() {
  var SandboxedModule, chai, expect, modulePath, sinon;

  sinon = require('sinon');

  chai = require('chai');

  expect = chai.expect;

  chai.should();

  SandboxedModule = require('sandboxed-module');

  modulePath = require('path').join(__dirname, '../../../app/js/SpellingAPIManager');

  describe("SpellingAPIManager", function() {
    beforeEach(function() {
      this.token = "user-id-123";
      this.ASpell = {};
      this.learnedWords = ["lerned"];
      this.LearnedWordsManager = {
        getLearnedWords: sinon.stub().callsArgWith(1, null, this.learnedWords),
        learnWord: sinon.stub().callsArg(2)
      };
      return this.SpellingAPIManager = SandboxedModule.require(modulePath, {
        requires: {
          "./ASpell": this.ASpell,
          "./LearnedWordsManager": this.LearnedWordsManager
        }
      });
    });
    describe("runRequest", function() {
      beforeEach(function() {
        this.nonLearnedWords = ["some", "words", "htat", "are", "speled", "rong", "lerned"];
        this.allWords = this.nonLearnedWords.concat(this.learnedWords);
        this.misspellings = [
          {
            index: 2,
            suggestions: ["that"]
          }, {
            index: 4,
            suggestions: ["spelled"]
          }, {
            index: 5,
            suggestions: ["wrong", "ring"]
          }, {
            index: 6,
            suggestions: ["learned"]
          }
        ];
        this.misspellingsWithoutLearnedWords = this.misspellings.slice(0, 3);
        this.ASpell.checkWords = (function(_this) {
          return function(lang, word, callback) {
            return callback(null, _this.misspellings);
          };
        })(this);
        return sinon.spy(this.ASpell, "checkWords");
      });
      describe("with sensible JSON", function() {
        beforeEach(function(done) {
          return this.SpellingAPIManager.runRequest(this.token, {
            words: this.allWords
          }, (function(_this) {
            return function(error, result) {
              _this.result = result;
              return done();
            };
          })(this));
        });
        return it("should return the words that are spelled incorrectly and not learned", function() {
          return expect(this.result.misspellings).to.deep.equal(this.misspellingsWithoutLearnedWords);
        });
      });
      describe("with a missing words array", function() {
        beforeEach(function(done) {
          return this.SpellingAPIManager.runRequest(this.token, {}, (function(_this) {
            return function(error, result) {
              _this.error = error;
              _this.result = result;
              return done();
            };
          })(this));
        });
        return it("should return an error", function() {
          return expect(this.error).to.deep.equal(new Error("malformed JSON"));
        });
      });
      describe("with a missing token", function() {
        beforeEach(function(done) {
          return this.SpellingAPIManager.runRequest(null, {
            words: this.allWords
          }, (function(_this) {
            return function(error, result) {
              _this.error = error;
              _this.result = result;
              return done();
            };
          })(this));
        });
        return it("should spell check without using any learned words", function() {
          return this.LearnedWordsManager.getLearnedWords.called.should.equal(false);
        });
      });
      describe("without a language", function() {
        beforeEach(function(done) {
          return this.SpellingAPIManager.runRequest(this.token, {
            words: this.allWords
          }, (function(_this) {
            return function(error, result) {
              _this.result = result;
              return done();
            };
          })(this));
        });
        return it("should use en as the default", function() {
          return this.ASpell.checkWords.calledWith("en").should.equal(true);
        });
      });
      describe("with a language", function() {
        beforeEach(function(done) {
          return this.SpellingAPIManager.runRequest(this.token, {
            words: this.allWords,
            language: this.language = "fr"
          }, (function(_this) {
            return function(error, result) {
              _this.result = result;
              return done();
            };
          })(this));
        });
        return it("should use the language", function() {
          return this.ASpell.checkWords.calledWith(this.language).should.equal(true);
        });
      });
      return describe("with a very large collection of words", function() {
        beforeEach(function(done) {
          var i;
          this.manyWords = (function() {
            var _i, _results;
            _results = [];
            for (i = _i = 1; _i <= 100000; i = ++_i) {
              _results.push("word");
            }
            return _results;
          })();
          return this.SpellingAPIManager.runRequest(this.token, {
            words: this.manyWords
          }, (function(_this) {
            return function(error, result) {
              _this.result = result;
              return done();
            };
          })(this));
        });
        return it("should truncate to 10,000 words", function() {
          return this.ASpell.checkWords.calledWith(sinon.match.any, this.manyWords.slice(0, 10000)).should.equal(true);
        });
      });
    });
    return describe("learnWord", function() {
      describe("without a token", function() {
        beforeEach(function(done) {
          return this.SpellingAPIManager.learnWord(null, {
            word: "banana"
          }, (function(_this) {
            return function(error) {
              _this.error = error;
              return done();
            };
          })(this));
        });
        return it("should return an error", function() {
          return expect(this.error).to.deep.equal(new Error("malformed JSON"));
        });
      });
      describe("without a word", function() {
        beforeEach(function(done) {
          return this.SpellingAPIManager.learnWord(this.token, {}, (function(_this) {
            return function(error) {
              _this.error = error;
              return done();
            };
          })(this));
        });
        return it("should return an error", function() {
          return expect(this.error).to.deep.equal(new Error("no token provided"));
        });
      });
      return describe("with a word and a token", function() {
        beforeEach(function(done) {
          this.word = "banana";
          return this.SpellingAPIManager.learnWord(this.token, {
            word: this.word
          }, (function(_this) {
            return function(error) {
              _this.error = error;
              return done();
            };
          })(this));
        });
        return it("should call LearnedWordsManager.learnWord", function() {
          return this.LearnedWordsManager.learnWord.calledWith(this.token, this.word).should.equal(true);
        });
      });
    });
  });

}).call(this);
