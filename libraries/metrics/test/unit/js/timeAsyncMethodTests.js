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
    return it('should work', function(done) {
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
  });

}).call(this);
