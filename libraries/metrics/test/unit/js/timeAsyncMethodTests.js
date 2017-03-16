(function() {
  var SandboxedModule, chai, expect, modulePath, path, should, sinon;

  require('coffee-script');

  chai = require('chai');

  should = chai.should();

  expect = chai.expect;

  path = require('path');

  modulePath = path.join(__dirname, '../../../timeAsyncMethod.coffee');

  SandboxedModule = require('sandboxed-module');

  sinon = require("sinon");

  describe('timeAsyncMethod', function() {
    beforeEach(function() {
      this.Timer = {
        done: sinon.stub()
      };
      this.TimerConstructor = sinon.stub().returns(this.Timer);
      this.metrics = {
        Timer: this.TimerConstructor
      };
      this.timeAsyncMethod = SandboxedModule.require(modulePath, {
        requires: {
          './metrics': this.metrics
        }
      });
      return this.testObject = {
        nextNumber: function(n, callback) {
          if (callback == null) {
            callback = function(err, result) {};
          }
          return setTimeout(function() {
            return callback(null, n + 1);
          }, 100);
        }
      };
    });
    it('should have the testObject behave correctly before wrapping', function(done) {
      return this.testObject.nextNumber(2, function(err, result) {
        expect(err).to.not.exist;
        expect(result).to.equal(3);
        return done();
      });
    });
    it('should wrap method without error', function(done) {
      this.timeAsyncMethod(this.testObject, 'nextNumber', 'test.nextNumber');
      return done();
    });
    it('should transparently wrap method invocation in timer', function(done) {
      this.timeAsyncMethod(this.testObject, 'nextNumber', 'test.nextNumber');
      return this.testObject.nextNumber(2, (function(_this) {
        return function(err, result) {
          expect(err).to.not.exist;
          expect(result).to.equal(3);
          expect(_this.TimerConstructor.callCount).to.equal(1);
          expect(_this.Timer.done.callCount).to.equal(1);
          return done();
        };
      })(this));
    });
    describe('when base method produces an error', function() {
      beforeEach(function() {
        return this.testObject.nextNumber = function(n, callback) {
          if (callback == null) {
            callback = function(err, result) {};
          }
          return setTimeout(function() {
            return callback(new Error('woops'));
          }, 100);
        };
      });
      return it('should propagate the error transparently', function(done) {
        this.timeAsyncMethod(this.testObject, 'nextNumber', 'test.nextNumber');
        return this.testObject.nextNumber(2, (function(_this) {
          return function(err, result) {
            expect(err).to.exist;
            expect(err).to.be["instanceof"](Error);
            expect(result).to.not.exist;
            return done();
          };
        })(this));
      });
    });
    describe('when a logger is supplied', function() {
      beforeEach(function() {
        return this.logger = {
          log: sinon.stub()
        };
      });
      return it('should also call logger.log', function(done) {
        this.timeAsyncMethod(this.testObject, 'nextNumber', 'test.nextNumber', this.logger);
        return this.testObject.nextNumber(2, (function(_this) {
          return function(err, result) {
            expect(err).to.not.exist;
            expect(result).to.equal(3);
            expect(_this.TimerConstructor.callCount).to.equal(1);
            expect(_this.Timer.done.callCount).to.equal(1);
            expect(_this.logger.log.callCount).to.equal(1);
            return done();
          };
        })(this));
      });
    });
    return describe('when the wrapper cannot be applied', function() {
      beforeEach(function() {});
      return it('should raise an error', function() {
        var badWrap;
        badWrap = (function(_this) {
          return function() {
            return _this.timeAsyncMethod(_this.testObject, 'DEFINITELY_NOT_A_REAL_METHOD', 'test.nextNumber');
          };
        })(this);
        return expect(badWrap).to["throw"](/^.*expected object property 'DEFINITELY_NOT_A_REAL_METHOD' to be a function.*$/);
      });
    });
  });

}).call(this);
