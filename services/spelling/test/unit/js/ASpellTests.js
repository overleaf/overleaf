(function() {
  var chai, should, sinon;

  sinon = require('sinon');

  chai = require('chai');

  should = chai.should();

  describe("ASpell", function() {
    beforeEach(function() {
      return this.ASpell = require("../../../app/js/ASpell");
    });
    describe("a correctly spelled word", function() {
      beforeEach(function(done) {
        return this.ASpell.checkWords("en", ["word"], (function(_this) {
          return function(error, result) {
            _this.result = result;
            return done();
          };
        })(this));
      });
      return it("should not correct the word", function() {
        return this.result.length.should.equal(0);
      });
    });
    describe("a misspelled word", function() {
      beforeEach(function(done) {
        return this.ASpell.checkWords("en", ["bussines"], (function(_this) {
          return function(error, result) {
            _this.result = result;
            return done();
          };
        })(this));
      });
      return it("should correct the word", function() {
        this.result.length.should.equal(1);
        return this.result[0].suggestions.indexOf("business").should.not.equal(-1);
      });
    });
    describe("multiple words", function() {
      beforeEach(function(done) {
        return this.ASpell.checkWords("en", ["bussines", "word", "neccesary"], (function(_this) {
          return function(error, result) {
            _this.result = result;
            return done();
          };
        })(this));
      });
      return it("should correct the incorrect words", function() {
        this.result[0].index.should.equal(0);
        this.result[0].suggestions.indexOf("business").should.not.equal(-1);
        this.result[1].index.should.equal(2);
        return this.result[1].suggestions.indexOf("necessary").should.not.equal(-1);
      });
    });
    describe("without a valid language", function() {
      beforeEach(function(done) {
        return this.ASpell.checkWords("notALang", ["banana"], (function(_this) {
          return function(error, result) {
            _this.error = error;
            _this.result = result;
            return done();
          };
        })(this));
      });
      return it("should return an error", function() {
        return should.exist(this.error);
      });
    });
    describe("when there are no suggestions", function() {
      beforeEach(function(done) {
        return this.ASpell.checkWords("en", ["asdkfjalkdjfadhfkajsdhfashdfjhadflkjadhflajsd"], (function(_this) {
          return function(error, result) {
            _this.error = error;
            _this.result = result;
            return done();
          };
        })(this));
      });
      return it("should return a blank array", function() {
        this.result.length.should.equal(1);
        return this.result[0].suggestions.should.deep.equal([]);
      });
    });
    return describe("when the request times out", function() {
      beforeEach(function(done) {
        var i, words;
        words = (function() {
          var _i, _results;
          _results = [];
          for (i = _i = 0; _i <= 1000000; i = ++_i) {
            _results.push("abcdefg");
          }
          return _results;
        })();
        this.ASpell.ASPELL_TIMEOUT = 100;
        this.start = new Date();
        return this.ASpell.checkWords("en", words, (function(_this) {
          return function(error, result) {
            _this.result = result;
            return done();
          };
        })(this));
      });
      return it("should return in reasonable time", function(done) {
        return done();
      });
    });
  });

}).call(this);
